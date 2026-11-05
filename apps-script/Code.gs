/**
 * Empowering Brew online orders (Google Apps Script).
 *
 * One script, deployed twice (see README.md in this folder):
 *  - Staff order page: Who has access = anyone in usd497.org. Staff sign in with their
 *    school account, pick a drink and a pickup time. No payment; they pay at pickup.
 *  - iPad link: Who has access = Anyone, but every call needs the secret key. The shop
 *    iPad checks it every 15 seconds for new orders and sends its current menu.
 *
 * Orders are kept in a Google Sheet that setup() creates. Nothing secret is in this file:
 * the sheet ID and the iPad key live in Script Properties.
 */

const ALLOWED_DOMAIN = 'usd497.org';
const SHOP_NAME = 'Empowering Brew';
const PICKUP_CHOICES = [0, 10, 15, 20]; // minutes from now; 0 = as soon as possible
const ASAP_MINUTES = 5;
const LAST_CALL_MINUTES = 10; // stop taking orders this long before closing
const IPAD_QUIET_MINUTES = 2; // the order page closes if the iPad stops checking in
const MAX_OPEN_ORDERS = 3; // per person at once
const NAME_LIMIT = 40;
const KEEP_DAYS = 14; // older orders are deleted every night

const ORDER_HEADERS = ['ID', 'Placed', 'Email', 'Name', 'Product ID', 'Drink', 'Flavor', 'Flavor shown', 'Changes', 'Decaf', 'Price', 'Pickup', 'Status', 'Updated', 'Sale ID'];
const COL = Object.fromEntries(ORDER_HEADERS.map((header, index) => [header, index]));
const ACTIVE = ['new', 'making', 'ready'];
const IPAD_STATUSES = ['new', 'making', 'ready', 'picked-up', 'not-picked-up', 'declined'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* ---------- Setup (run these from the editor) ---------- */

// Run once. Creates the order sheet, the iPad key and the nightly cleanup.
function setup() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) {
    const book = SpreadsheetApp.create(`${SHOP_NAME} online orders`);
    sheetId = book.getId();
    props.setProperty('SHEET_ID', sheetId);
  }
  const book = SpreadsheetApp.openById(sheetId);
  let orders = book.getSheetByName('Orders');
  if (!orders) {
    orders = book.getSheets()[0];
    orders.setName('Orders');
  }
  if (orders.getLastRow() === 0) {
    orders.appendRow(ORDER_HEADERS);
    orders.setFrozenRows(1);
    orders.getRange(1, 1, 1, ORDER_HEADERS.length).setFontWeight('bold');
  }
  let shop = book.getSheetByName('Shop');
  if (!shop) {
    shop = book.insertSheet('Shop');
    shop.getRange('A1:B2').setValues([['What', 'Value'], ['Menu (sent by the shop iPad)', '']]);
    shop.setFrozenRows(1);
  }
  if (!props.getProperty('LINK_KEY')) props.setProperty('LINK_KEY', newKeyValue_());
  if (!ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === 'cleanUp')) {
    ScriptApp.newTrigger('cleanUp').timeBased().everyDays(1).atHour(3).create();
  }
  showSetup();
}

// Shows the sheet address and the iPad key again (View → Logs / Execution log).
function showSetup() {
  const props = PropertiesService.getScriptProperties();
  console.log(`Order sheet: https://docs.google.com/spreadsheets/d/${props.getProperty('SHEET_ID')}/edit`);
  console.log(`iPad link key: ${props.getProperty('LINK_KEY')}`);
  console.log('Paste the iPad link address and this key into the iPad: Staff → Reports → Online orders.');
}

// Makes a new iPad key (if the old one got out). Enter the new key on the iPad afterwards.
function newKey() {
  PropertiesService.getScriptProperties().setProperty('LINK_KEY', newKeyValue_());
  showSetup();
}

function newKeyValue_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

/* ---------- Staff order page ---------- */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Order')
    .setTitle(`${SHOP_NAME} — Order ahead`)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Everything the order page shows: who is ordering, whether the shop is open, the menu,
// and this person's orders today.
function getOrderPage() {
  const email = currentEmail_();
  const status = shopStatus_(new Date());
  return {
    email,
    name: nameFromEmail_(email),
    shop: status,
    menu: status.open ? readMenu_() : null,
    pickupChoices: PICKUP_CHOICES.map((minutes) => ({ minutes, label: minutes ? `In ${minutes} minutes` : `As soon as possible (about ${ASAP_MINUTES} min)` })),
    orders: myOrders_(email),
  };
}

function placeOrder(form) {
  const email = currentEmail_();
  const now = new Date();
  const status = shopStatus_(now);
  if (!status.open) throw new Error(status.reason);
  const menu = readMenu_();
  const order = checkOrder_(form, menu, now);
  return withLock_(() => {
    const open = readOrders_().filter((row) => row.email === email && ACTIVE.includes(row.status) && isToday_(row.placedAt, now));
    if (open.length >= MAX_OPEN_ORDERS) throw new Error(`You already have ${open.length} orders waiting. Pick those up first, or cancel one.`);
    const id = Utilities.getUuid();
    const row = [];
    row[COL.ID] = id;
    row[COL.Placed] = now;
    row[COL.Email] = email;
    row[COL.Name] = safeText_(order.name);
    row[COL['Product ID']] = order.productId;
    row[COL.Drink] = safeText_(order.drink);
    row[COL.Flavor] = safeText_(order.option || '');
    row[COL['Flavor shown']] = safeText_(order.optionLabel || '');
    row[COL.Changes] = safeText_(order.changes.join('; '));
    row[COL.Decaf] = order.decaf ? 'Yes' : '';
    row[COL.Price] = order.price;
    row[COL.Pickup] = order.pickupAt;
    row[COL.Status] = 'new';
    row[COL.Updated] = now;
    row[COL['Sale ID']] = '';
    ordersSheet_().appendRow(row);
    return getOrderPage();
  });
}

// Staff can cancel only before students start making the drink.
function cancelOrder(id) {
  const email = currentEmail_();
  return withLock_(() => {
    const row = readOrders_().find((entry) => entry.id === id && entry.email === email);
    if (!row) throw new Error('That order was not found.');
    if (row.status !== 'new') throw new Error('Students already started this drink, so it can no longer be cancelled. Stop by the shop.');
    writeStatus_(row, 'cancelled');
    return getOrderPage();
  });
}

// Checks an order against the menu the shop iPad sent, so only drinks, flavors and
// changes the iPad can record get through.
function checkOrder_(form, menu, now) {
  if (!menu) throw new Error('The shop menu is not available yet.');
  form = form || {};
  let found = null;
  for (const item of menu.items || []) {
    for (const variant of item.variants || []) if (variant.id === form.productId) found = { item, variant };
  }
  if (!found) throw new Error('That drink is not on the menu right now. Refresh the page and try again.');
  const { item, variant } = found;
  const options = variant.options || [];
  const chosen = options.find((option) => option.value === form.option);
  if (options.length && !chosen) throw new Error('Choose a flavor.');
  const allowed = (variant.choices || {})[chosen ? chosen.value : ''] || { remove: [], add: [] };
  const changes = Array.isArray(form.changes) ? form.changes.map(String) : [];
  if (changes.some((change) => !allowed.remove.includes(change) && !allowed.add.includes(change))) throw new Error('One of the changes is not available. Refresh the page and try again.');
  const name = String(form.name || '').trim().slice(0, NAME_LIMIT);
  if (!name) throw new Error('Enter the name to call out at pickup.');
  const minutes = Number(form.pickupMinutes);
  if (!PICKUP_CHOICES.includes(minutes)) throw new Error('Choose a pickup time.');
  const wait = minutes || ASAP_MINUTES;
  const hours = menu.hours;
  if (minutesOfDay_(now) + wait > hours.closeMinutes) throw new Error(`That is after the shop closes at ${clock_(hours.closeMinutes)}. Choose an earlier time.`);
  return {
    productId: variant.id,
    drink: variant.label,
    option: chosen ? chosen.value : '',
    optionLabel: chosen ? chosen.label : '',
    changes: [...new Set(changes)],
    decaf: !!form.decaf && item.kind === 'drink',
    price: Number(variant.price) || 0,
    name,
    pickupAt: new Date(now.getTime() + wait * 60000),
  };
}

function myOrders_(email) {
  const now = new Date();
  return readOrders_().filter((row) => row.email === email && isToday_(row.placedAt, now)).map(publicOrder_).reverse();
}

/* ---------- iPad link ---------- */

function doPost(e) {
  let request;
  try { request = JSON.parse(e.postData.contents); } catch (error) { return json_({ ok: false, error: 'The request could not be read.' }); }
  const key = PropertiesService.getScriptProperties().getProperty('LINK_KEY');
  if (!key || request.key !== key) return json_({ ok: false, error: 'The iPad link key is not right. Copy it again from the Apps Script setup (run showSetup).' });
  try {
    if (request.action === 'test') return json_({ ok: true, shop: SHOP_NAME });
    if (request.action === 'poll') return json_(poll_(request));
    if (request.action === 'status') return json_(setStatus_(request));
    return json_({ ok: false, error: 'Unknown request.' });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

// The iPad checks in: say it is open (or paused), save its menu if it sent one, and
// send back today's orders that are still waiting.
function poll_(request) {
  const now = new Date();
  CacheService.getScriptCache().put('heartbeat', JSON.stringify({ at: now.getTime(), paused: !!request.paused }), 600);
  if (request.menu) saveMenu_(request.menu);
  const orders = readOrders_().filter((row) => ACTIVE.includes(row.status) && isToday_(row.placedAt, now)).map(publicOrder_);
  return { ok: true, orders, shop: shopStatus_(now), serverTime: now.toISOString() };
}

function setStatus_(request) {
  if (!IPAD_STATUSES.includes(request.status)) throw new Error('Unknown order status.');
  return withLock_(() => {
    const row = readOrders_().find((entry) => entry.id === request.id);
    if (!row) throw new Error('That order is no longer in the order sheet.');
    if (row.status === 'cancelled') throw new Error(`${row.name} cancelled this order.`);
    writeStatus_(row, request.status, request.saleId);
    return { ok: true, order: publicOrder_({ ...row, status: request.status }) };
  });
}

function saveMenu_(menu) {
  if (!menu || !Array.isArray(menu.items) || !menu.hours) throw new Error('The menu from the iPad could not be read.');
  const text = JSON.stringify(menu);
  withLock_(() => shopSheet_().getRange('B2').setValue(text));
  try { CacheService.getScriptCache().put('menu', text, 21600); } catch (error) { /* too big to cache; read the sheet */ }
}

function readMenu_() {
  let text = CacheService.getScriptCache().get('menu');
  if (!text) text = String(shopSheet_().getRange('B2').getValue() || '');
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { return null; }
}

/* ---------- Open or closed ---------- */

// Open = during shop hours (until last call), the iPad has checked in within the last
// couple of minutes, and the shop has not paused orders. If the iPad is off or the app
// is closed, nobody would see an order, so the page says to stop by instead.
function shopStatus_(now) {
  const menu = readMenu_();
  if (!menu) return { open: false, reason: 'Online ordering is not set up yet. Stop by the coffee shop to order.' };
  const hours = menu.hours;
  const day = dayIndex_(now);
  const minutes = minutesOfDay_(now);
  const hoursText = `The coffee shop takes online orders ${hours.days.map((index) => DAYS[index]).join(', ')}, ${clock_(hours.openMinutes)} to ${clock_(hours.closeMinutes - LAST_CALL_MINUTES)}.`;
  if (!hours.days.includes(day) || minutes < hours.openMinutes || minutes >= hours.closeMinutes - LAST_CALL_MINUTES) return { open: false, reason: `The coffee shop is closed right now. ${hoursText}` };
  const beat = JSON.parse(CacheService.getScriptCache().get('heartbeat') || 'null');
  if (!beat || now.getTime() - beat.at > IPAD_QUIET_MINUTES * 60000) return { open: false, reason: 'The coffee shop is not taking online orders right now. Stop by the shop to order.' };
  if (beat.paused) return { open: false, reason: 'The coffee shop is busy and has paused online orders for a few minutes. Try again soon, or stop by.' };
  return { open: true, reason: '' };
}

/* ---------- Order sheet ---------- */

function book_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Run setup() in the Apps Script editor first.');
  return SpreadsheetApp.openById(id);
}
function ordersSheet_() { return book_().getSheetByName('Orders'); }
function shopSheet_() { return book_().getSheetByName('Shop'); }

function readOrders_() {
  const sheet = ordersSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, ORDER_HEADERS.length).getValues().map((values, index) => ({
    row: index + 2,
    id: String(values[COL.ID]),
    placedAt: asDate_(values[COL.Placed]),
    email: String(values[COL.Email]),
    name: String(values[COL.Name]),
    productId: String(values[COL['Product ID']]),
    drink: String(values[COL.Drink]),
    option: String(values[COL.Flavor] || ''),
    optionLabel: String(values[COL['Flavor shown']] || ''),
    changes: String(values[COL.Changes] || '').split('; ').filter(Boolean),
    decaf: values[COL.Decaf] === 'Yes',
    price: Number(values[COL.Price]) || 0,
    pickupAt: asDate_(values[COL.Pickup]),
    status: String(values[COL.Status]),
    saleId: String(values[COL['Sale ID']] || ''),
  })).filter((row) => row.id);
}

function writeStatus_(row, status, saleId) {
  const sheet = ordersSheet_();
  sheet.getRange(row.row, COL.Status + 1, 1, 2).setValues([[status, new Date()]]);
  if (saleId) sheet.getRange(row.row, COL['Sale ID'] + 1).setValue(String(saleId));
}

// What the iPad and the order page get back (no row numbers).
function publicOrder_(row) {
  return {
    id: row.id, placedAt: row.placedAt.toISOString(), name: row.name, productId: row.productId, drink: row.drink,
    option: row.option, optionLabel: row.optionLabel, changes: row.changes, decaf: row.decaf, price: row.price,
    pickupAt: row.pickupAt.toISOString(), status: row.status,
  };
}

// Runs every night at 3 AM (setup() adds the trigger): deletes orders older than KEEP_DAYS.
function cleanUp() {
  withLock_(() => {
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    const sheet = ordersSheet_();
    const old = readOrders_().filter((row) => row.placedAt.getTime() < cutoff).map((row) => row.row).sort((a, b) => b - a);
    old.forEach((rowNumber) => sheet.deleteRow(rowNumber));
  });
}

/* ---------- Helpers ---------- */

function currentEmail_() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) throw new Error(`Please open the order page signed in with your school (${ALLOWED_DOMAIN}) Google account.`);
  return email;
}

// jane.smith@usd497.org → Jane Smith (staff can change it before ordering).
function nameFromEmail_(email) {
  return email.split('@')[0].split(/[._-]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

// Text that starts with = + - or @ would be read by Sheets as a formula.
function safeText_(text) {
  const value = String(text);
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function withLock_(work) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return work(); } finally { lock.releaseLock(); }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function asDate_(value) {
  if (value && typeof value.getTime === 'function') return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? new Date(0) : date;
}

const zone_ = () => Session.getScriptTimeZone();
const dayIndex_ = (date) => Number(Utilities.formatDate(date, zone_(), 'u')) - 1; // Monday = 0
const minutesOfDay_ = (date) => Number(Utilities.formatDate(date, zone_(), 'H')) * 60 + Number(Utilities.formatDate(date, zone_(), 'm'));
const isToday_ = (date, now) => Utilities.formatDate(date, zone_(), 'yyyy-MM-dd') === Utilities.formatDate(now, zone_(), 'yyyy-MM-dd');
function clock_(minutes) {
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}
