import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { cloneInitialState } from './data';
import { migrate } from './storage';
import { orderSaleParts, orderingMenu } from './orders';

// Runs apps-script/Code.gs in Node against small stand-ins for the Google services it
// uses (a sheet, the cache, the signed-in user), so the order rules are tested before deploying.

const CODE = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const ZONE = 'America/Chicago';
const THURSDAY_1030 = Date.parse('2026-11-05T16:30:00Z'); // 10:30 AM Central, an open day

function fakeSheet(name) {
  const sheet = {
    name, rows: [],
    setName(next) { sheet.name = next; },
    getLastRow: () => sheet.rows.length,
    appendRow(values) { sheet.rows.push([...values]); },
    setFrozenRows() {},
    deleteRow(row) { sheet.rows.splice(row - 1, 1); },
    getRange(a, b, c = 1, d = 1) {
      let row = a; let col = b;
      if (typeof a === 'string') { const match = /^([A-Z])(\d+)/.exec(a); col = match[1].charCodeAt(0) - 64; row = Number(match[2]); [c, d] = a.includes(':') ? [2, 2] : [1, 1]; }
      const cell = (r, k) => (sheet.rows[r] || [])[k] ?? '';
      const put = (r, k, value) => { while (sheet.rows.length <= r) sheet.rows.push([]); sheet.rows[r][k] = value; };
      return {
        getValues: () => Array.from({ length: c }, (_, r) => Array.from({ length: d }, (_, k) => cell(row - 1 + r, col - 1 + k))),
        setValues: (values) => values.forEach((line, r) => line.forEach((value, k) => put(row - 1 + r, col - 1 + k, value))),
        getValue: () => cell(row - 1, col - 1),
        setValue: (value) => put(row - 1, col - 1, value),
        setFontWeight() {},
      };
    },
  };
  return sheet;
}

function googleWorld() {
  const clock = { now: THURSDAY_1030 };
  const props = new Map();
  const cache = new Map();
  const triggers = [];
  const user = { email: 'jane.smith@usd497.org' };
  let book = null;
  const parts = (date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date).map((part) => [part.type, part.value]));
  class FakeDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(clock.now); }
    static now() { return clock.now; }
  }
  const context = {
    Date: FakeDate, JSON, Math, Number, String, Object, Array, Set, Error, isNaN, console: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => props.get(key) ?? null, setProperty: (key, value) => props.set(key, value) }) },
    CacheService: { getScriptCache: () => ({ get: (key) => cache.get(key) ?? null, put: (key, value) => cache.set(key, value) }) },
    Session: { getActiveUser: () => ({ getEmail: () => user.email }), getScriptTimeZone: () => ZONE },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate(date, zone, format) {
        const p = parts(date);
        if (format === 'u') return String(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1);
        if (format === 'H') return String(Number(p.hour));
        if (format === 'm') return String(Number(p.minute));
        if (format === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
        throw new Error(`format ${format}`);
      },
    },
    SpreadsheetApp: {
      create() { const sheets = [fakeSheet('Sheet1')]; book = { sheets, getId: () => 'sheet-1', getSheets: () => sheets, getSheetByName: (name) => sheets.find((sheet) => sheet.name === name) || null, insertSheet: (name) => { const sheet = fakeSheet(name); sheets.push(sheet); return sheet; } }; return book; },
      openById: () => book,
    },
    ScriptApp: { getProjectTriggers: () => triggers, newTrigger: (name) => { const chain = { timeBased: () => chain, everyDays: () => chain, atHour: () => chain, create: () => triggers.push({ getHandlerFunction: () => name }) }; return chain; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType() { return this; } }) },
    HtmlService: {},
  };
  vm.createContext(context);
  vm.runInContext(CODE, context);
  const ipad = (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ key: props.get('LINK_KEY'), ...body }) } }).text);
  return { context, clock, props, cache, triggers, user, ipad, orders: () => book.getSheetByName('Orders').rows.slice(1) };
}

const state = migrate(cloneInitialState('2026-11-04T15:00:00.000Z'));
const MENU = orderingMenu(state);
const pawOrder = { productId: 'panther-paw-hot', option: '', changes: ['No whipped cream', 'Extra shot'], decaf: false, pickupMinutes: 0, name: 'Ms. Smith' };

describe('Apps Script order page and iPad link', () => {
  let g;
  beforeEach(() => {
    g = googleWorld();
    g.context.setup();
  });
  const openShop = (extra = {}) => g.ipad({ action: 'poll', paused: false, menu: MENU, ...extra });

  it('setup creates the order sheet, a long iPad key and the nightly cleanup once', () => {
    expect(g.orders()).toEqual([]);
    expect(g.props.get('LINK_KEY')).toMatch(/^[0-9a-f]{40}$/);
    g.context.setup();
    expect(g.triggers).toHaveLength(1);
  });

  it('only lets people signed in with a district account in', () => {
    g.user.email = 'someone@gmail.com';
    expect(() => g.context.getOrderPage()).toThrow(/school \(usd497.org\)/);
    g.user.email = '';
    expect(() => g.context.getOrderPage()).toThrow(/school/);
    g.user.email = 'jane.smith@usd497.org';
    expect(g.context.getOrderPage().name).toBe('Jane Smith');
  });

  it('rejects iPad calls without the right key', () => {
    const result = JSON.parse(g.context.doPost({ postData: { contents: JSON.stringify({ key: 'guess', action: 'poll' }) } }).text);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/key is not right/);
    expect(g.ipad({ action: 'test' }).ok).toBe(true);
  });

  it('is closed until the iPad checks in, and again if it goes quiet or pauses', () => {
    expect(g.context.getOrderPage().shop.open).toBe(false);
    openShop();
    const page = g.context.getOrderPage();
    expect(page.shop.open).toBe(true);
    expect(page.menu.items.length).toBe(MENU.items.length);
    g.clock.now += 3 * 60000;
    expect(g.context.getOrderPage().shop.reason).toMatch(/not taking online orders/);
    openShop({ paused: true });
    expect(g.context.getOrderPage().shop.reason).toMatch(/paused/);
  });

  it('follows shop hours and last call', () => {
    openShop();
    g.clock.now = Date.parse('2026-11-05T19:55:00Z'); // 1:55 PM, inside the last 10 minutes
    openShop();
    expect(g.context.getOrderPage().shop.reason).toMatch(/closed right now.*1:50 PM/);
    g.clock.now = Date.parse('2026-11-04T16:30:00Z'); // Wednesday
    openShop();
    expect(g.context.getOrderPage().shop.open).toBe(false);
  });

  it('takes an order, and the iPad gets it in pickup order', () => {
    openShop();
    const page = g.context.placeOrder(pawOrder);
    expect(page.orders).toHaveLength(1);
    expect(page.orders[0]).toMatchObject({ drink: 'Panther Paw Caramel Latte · Hot', status: 'new', price: 3.5, changes: ['No whipped cream', 'Extra shot'] });
    expect(Date.parse(page.orders[0].pickupAt) - THURSDAY_1030).toBe(5 * 60000);
    g.context.placeOrder({ productId: 'latte-flavored-iced', option: 'Caramel', changes: [], pickupMinutes: 0, name: 'Jane', decaf: true });
    const polled = openShop();
    expect(polled.orders.map((order) => order.productId)).toEqual(['panther-paw-hot', 'latte-flavored-iced']);
    expect(polled.orders[1]).toMatchObject({ option: 'Caramel', decaf: true });
  });

  it('an order from the page records on the iPad exactly as placed', () => {
    openShop();
    g.context.placeOrder({ ...pawOrder, decaf: true });
    const [order] = openShop().orders;
    const parts = orderSaleParts(state, order);
    expect(parts.problem).toBeUndefined();
    expect(parts).toMatchObject({ option: null, changes: ['No whipped cream', 'Extra shot'], dropped: [], decaf: true });
  });

  it('checks every order against the menu the iPad sent', () => {
    openShop();
    expect(() => g.context.placeOrder({ ...pawOrder, productId: 'nope' })).toThrow(/not on the menu/);
    expect(() => g.context.placeOrder({ ...pawOrder, productId: 'latte-flavored-hot' })).toThrow(/Choose a flavor/);
    expect(() => g.context.placeOrder({ ...pawOrder, changes: ['Add gold flakes'] })).toThrow(/changes is not available/);
    expect(() => g.context.placeOrder({ ...pawOrder, name: '  ' })).toThrow(/name/);
    expect(() => g.context.placeOrder({ ...pawOrder, pickupMinutes: 45 })).toThrow(/pickup time/);
    g.clock.now = Date.parse('2026-11-05T19:45:00Z'); // 1:45 PM
    openShop();
    expect(() => g.context.placeOrder({ ...pawOrder, pickupMinutes: 20 })).toThrow(/after the shop closes at 2:00 PM/);
    expect(g.orders()).toHaveLength(0);
  });

  it('never makes a bakery treat decaf, and keeps names from being read as formulas', () => {
    openShop();
    g.context.placeOrder({ productId: 'bakery-sweet-treat', option: '', changes: [], pickupMinutes: 10, decaf: true, name: '=HYPERLINK("x")' });
    const [row] = g.orders();
    expect(row[3]).toBe('\'=HYPERLINK("x")');
    expect(row[9]).toBe('');
  });

  it('limits each person to three waiting orders', () => {
    openShop();
    for (let count = 0; count < 3; count += 1) g.context.placeOrder(pawOrder);
    expect(() => g.context.placeOrder(pawOrder)).toThrow(/already have 3 orders/);
    g.user.email = 'other.teacher@usd497.org';
    expect(g.context.placeOrder(pawOrder).orders).toHaveLength(1);
  });

  it('moves orders through making, ready and picked up, and keeps the sale ID', () => {
    openShop();
    g.context.placeOrder(pawOrder);
    const [order] = openShop().orders;
    expect(g.ipad({ action: 'status', id: order.id, status: 'making' }).ok).toBe(true);
    expect(g.context.getOrderPage().orders[0].status).toBe('making');
    expect(g.ipad({ action: 'status', id: order.id, status: 'picked-up', saleId: 'sale-123' }).ok).toBe(true);
    expect(g.orders()[0][14]).toBe('sale-123');
    expect(openShop().orders).toHaveLength(0);
    expect(g.ipad({ action: 'status', id: order.id, status: 'eaten' }).error).toMatch(/Unknown order status/);
  });

  it('staff can cancel only before the drink is started', () => {
    openShop();
    g.context.placeOrder(pawOrder);
    const [first] = openShop().orders;
    expect(g.context.cancelOrder(first.id).orders[0].status).toBe('cancelled');
    expect(g.ipad({ action: 'status', id: first.id, status: 'making' }).error).toMatch(/cancelled this order/);
    g.context.placeOrder(pawOrder);
    const [second] = openShop().orders;
    g.ipad({ action: 'status', id: second.id, status: 'making' });
    expect(() => g.context.cancelOrder(second.id)).toThrow(/can no longer be cancelled/);
    g.user.email = 'other.teacher@usd497.org';
    expect(() => g.context.cancelOrder(second.id)).toThrow(/not found/);
  });

  it('shows only today\'s orders and deletes ones older than two weeks', () => {
    openShop();
    g.context.placeOrder(pawOrder);
    g.clock.now += 86400000; // Friday
    openShop();
    expect(openShop().orders).toHaveLength(0);
    expect(g.context.getOrderPage().orders).toHaveLength(0);
    g.context.placeOrder(pawOrder);
    g.clock.now += 14 * 86400000 - 60000;
    g.context.cleanUp();
    expect(g.orders()).toHaveLength(1);
  });
});
