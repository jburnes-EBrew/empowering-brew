import { describe, expect, it, vi } from 'vitest';
import { cloneInitialState } from './data';
import { migrate } from './storage';
import { callLink, inOrderWindow, orderSaleParts, orderingMenu, saleForOrder, sortOrders } from './orders';
import { makeSale } from './sales';

const fresh = () => migrate(cloneInitialState('2026-11-04T15:00:00.000Z'));
const variantOf = (menu, id) => menu.items.flatMap((item) => item.variants).find((variant) => variant.id === id);

describe('ordering menu sent to the order page', () => {
  it('lists active drinks with their hot and iced versions, prices and the bakery treat', () => {
    const menu = orderingMenu(fresh());
    const names = menu.items.map((item) => item.name);
    expect(names).toContain('Panther Paw Caramel Latte');
    expect(names).toContain('Bakery Sweet Treat');
    expect(variantOf(menu, 'panther-paw-iced').label).toBe('Panther Paw Caramel Latte · Iced');
    expect(variantOf(menu, 'bakery-sweet-treat').price).toBe(2.5);
    expect(menu.items.find((item) => item.name === 'Bakery Sweet Treat').kind).toBe('food');
    expect(menu.hours.days).toEqual([0, 1, 3, 4]);
  });

  it('names the monthly special after this month\'s flavor', () => {
    const state = fresh();
    state.settings.monthlySpecial = 'Peppermint Mocha';
    const special = orderingMenu(state).items.find((item) => item.special);
    expect(special.name).toBe('Peppermint Mocha');
    expect(variantOf(orderingMenu(state), 'monthly-special-hot').label).toBe('Peppermint Mocha (Monthly Special) · Hot');
  });

  it('offers the same flavors and changes as the drink box on the sales screen', () => {
    const latte = variantOf(orderingMenu(fresh()), 'latte-flavored-hot');
    expect(latte.options.map((option) => option.value)).toContain('Vanilla');
    expect(Object.keys(latte.choices)).toEqual(latte.options.map((option) => option.value));
    expect(latte.choices.Vanilla.add).toContain('Extra shot');
    const paw = variantOf(orderingMenu(fresh()), 'panther-paw-hot');
    expect(Object.keys(paw.choices)).toEqual(['']);
    expect(paw.choices[''].remove.length).toBeGreaterThan(0);
    expect(variantOf(orderingMenu(fresh()), 'bakery-sweet-treat').choices['']).toEqual({ remove: [], add: [] });
  });

  it('leaves out drinks turned off on the iPad', () => {
    const state = fresh();
    state.menuItems = state.menuItems.map((item) => item.id === 'espresso' ? { ...item, active: false } : item);
    state.products = state.products.map((product) => product.id === 'panther-paw-iced' ? { ...product, active: false } : product);
    const menu = orderingMenu(state);
    expect(menu.items.some((item) => item.id === 'espresso')).toBe(false);
    expect(variantOf(menu, 'panther-paw-iced')).toBeUndefined();
    expect(variantOf(menu, 'panther-paw-hot')).toBeDefined();
  });
});

describe('recording an online order as a sale', () => {
  const order = { id: 'order-1', productId: 'panther-paw-hot', option: '', changes: ['No whipped cream', 'Extra shot'], decaf: true };

  it('records exactly what a student tapping the same drink would record, plus the order ID', () => {
    const state = fresh();
    const parts = orderSaleParts(state, order);
    expect(parts.problem).toBeUndefined();
    const fromOrder = makeSale(state, parts.product, parts.option, parts.changes, { decaf: parts.decaf, orderId: order.id, soldAt: '2026-11-05T16:00:00.000Z' });
    const tapped = makeSale(state, parts.product, null, parts.changes, { decaf: true, soldAt: '2026-11-05T16:00:00.000Z' });
    expect(fromOrder.orderId).toBe('order-1');
    expect({ ...fromOrder, id: '', orderId: undefined }).toEqual({ ...tapped, id: '', orderId: undefined });
    expect(fromOrder.decaf).toBe(true);
    expect(fromOrder.price).toBe(3.5);
    expect(fromOrder.usage.some((use) => use.itemId === 'coffee-decaf')).toBe(true);
  });

  it('keeps the flavor for flavored lattes', () => {
    const parts = orderSaleParts(fresh(), { productId: 'latte-flavored-iced', option: 'Caramel', changes: [] });
    expect(parts.option).toBe('Caramel');
  });

  it('reports a drink or flavor that is no longer offered instead of guessing', () => {
    const state = fresh();
    state.products = state.products.map((product) => product.id === 'panther-paw-hot' ? { ...product, active: false } : product);
    expect(orderSaleParts(state, order).problem).toMatch(/no longer on the menu/);
    expect(orderSaleParts(fresh(), { productId: 'latte-flavored-hot', option: 'Bubblegum', changes: [] }).problem).toMatch(/flavor/);
  });

  it('drops changes the iPad no longer offers and says which', () => {
    const parts = orderSaleParts(fresh(), { ...order, changes: ['Extra shot', 'Add sprinkles'] });
    expect(parts.changes).toEqual(['Extra shot']);
    expect(parts.dropped).toEqual(['Add sprinkles']);
  });

  it('never makes a bakery treat decaf', () => {
    expect(orderSaleParts(fresh(), { productId: 'bakery-sweet-treat', option: '', changes: [], decaf: true }).decaf).toBe(false);
  });

  it('finds the sale for an order, ignoring an undone one', () => {
    const sales = [{ id: 's1', orderId: 'order-1', voidedAt: '2026-11-05T16:01:00.000Z' }, { id: 's2', orderId: 'order-1' }];
    expect(saleForOrder(sales, 'order-1').id).toBe('s2');
    expect(saleForOrder([sales[0]], 'order-1')).toBeNull();
  });
});

describe('order list and timing', () => {
  it('sorts by pickup time, then by when the order came in', () => {
    const sorted = sortOrders([
      { id: 'b', pickupAt: '2026-11-05T16:20:00Z', placedAt: '2026-11-05T16:05:00Z' },
      { id: 'a', pickupAt: '2026-11-05T16:10:00Z', placedAt: '2026-11-05T16:06:00Z' },
      { id: 'c', pickupAt: '2026-11-05T16:20:00Z', placedAt: '2026-11-05T16:01:00Z' },
    ]);
    expect(sorted.map((order) => order.id)).toEqual(['a', 'c', 'b']);
  });

  it('checks for orders only around shop hours on open days', () => {
    expect(inOrderWindow(new Date(2026, 10, 5, 9, 50))).toBe(true); // Thursday, 10 minutes before opening
    expect(inOrderWindow(new Date(2026, 10, 5, 14, 20))).toBe(true); // late pickups after closing
    expect(inOrderWindow(new Date(2026, 10, 5, 9, 30))).toBe(false);
    expect(inOrderWindow(new Date(2026, 10, 5, 14, 40))).toBe(false);
    expect(inOrderWindow(new Date(2026, 10, 4, 11, 0))).toBe(false); // Wednesday: closed
  });
});

describe('iPad link calls', () => {
  const settings = { url: ' https://script.google.com/macros/s/abc/exec ', key: ' secret ' };

  it('sends the key and action as plain text so the browser can call Apps Script', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, orders: [] }) }));
    await callLink(settings, 'poll', { paused: false }, fetcher);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://script.google.com/macros/s/abc/exec');
    expect(options.method).toBe('POST');
    expect(options.headers).toBeUndefined();
    expect(JSON.parse(options.body)).toEqual({ paused: false, key: 'secret', action: 'poll' });
  });

  it('turns failures into plain-language messages', async () => {
    await expect(callLink(settings, 'test', {}, async () => { throw new TypeError('Failed to fetch'); })).rejects.toThrow(/internet connection/);
    await expect(callLink(settings, 'test', {}, async () => ({ ok: true, json: async () => { throw new SyntaxError('<html>'); } }))).rejects.toThrow(/web page instead of orders/);
    await expect(callLink(settings, 'test', {}, async () => ({ ok: true, json: async () => ({ ok: false, error: 'The iPad link key is not right.' }) }))).rejects.toThrow('The iPad link key is not right.');
    await expect(callLink(settings, 'test', {}, async () => ({ ok: false, status: 500 }))).rejects.toThrow(/error 500/);
  });
});
