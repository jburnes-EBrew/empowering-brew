import { FLAVOR_NOTE, SCHEMA_VERSION, SEED_VERSION_LABEL, cloneInitialState } from './data';

// Spelling notes from the first import; the owner reviewed them and asked for them removed.
const DISMISSED_NAME_NOTES = new Set(["Extra hyphen in source name.", "Source abbreviates \"Jayhawk Marshmallow\" as \"Marsh\".", "Source abbreviates \"Jayhawk Marshmallow\" as \"Marsh\".", "Lowercase \"paw\" in source.", "Two spaces before \"ICED\" in source.", "Source spells \"Rolle\".", "Source says \"Pride\"; card and menu say \"Panther\".", "Source says \"Pride\" and \"Cooke.\"; card and menu say \"Panther Cookie\"."]);
const OLD_FLAVOR_NOTE = 'Workbook does not say which flavor or how much; flavor is recorded as a sale option only.';

const KEY = 'empowering-brew-state-v1';

// Upgrades saved data in place. Sales, inventory events, count sessions and the
// staff PIN are always carried forward; nothing recorded on the iPad is discarded.
export function migrate(saved) {
  if (saved?.schemaVersion === SCHEMA_VERSION) return {
    ...saved,
    menuItems: saved.menuItems.map((item) => item.reviewNote === OLD_FLAVOR_NOTE ? { ...item, reviewNote: FLAVOR_NOTE } : item),
    products: saved.products.map((product) => DISMISSED_NAME_NOTES.has(product.reviewNote) ? { ...product, reviewNote: '' } : product),
    recipes: saved.recipes.map((recipe) => recipe.versionLabel === 'Placeholder v1' ? { ...recipe, versionLabel: SEED_VERSION_LABEL } : recipe),
    settings: { backupTime: '15:00', lastSalesBackupAt: null, ...saved.settings },
  };
  if (saved?.schemaVersion !== 2) return cloneInitialState();
  // The opening balance must predate everything already recorded.
  const times = [...(saved.sales || []).map((sale) => sale.soldAt), ...(saved.inventoryEvents || []).map((event) => event.occurredAt)].filter(Boolean).map((iso) => Date.parse(iso));
  const next = cloneInitialState(new Date(Math.min(Date.now(), ...times) - 1).toISOString());
  next.staffPinHash = saved.staffPinHash ?? null;
  next.sales = (saved.sales || []).map((sale) => ({
    ...sale,
    temperature: sale.temperature === 'other' ? 'none' : sale.temperature,
    menuItemId: next.products.find((product) => product.id === sale.productId)?.menuItemId ?? null,
    option: sale.modifier ?? null,
    usage: [],
    gaps: ['Recorded before ingredient estimates were available'],
    estimateStatus: 'not-configured',
  }));
  next.inventoryEvents.push(...(saved.inventoryEvents || []).map((event) => {
    const counted = event.type === 'reconciliation' ? Number(/Physical count ([\d.]+)/.exec(event.note || '')?.[1]) : NaN;
    return Number.isFinite(counted)
      ? { ...event, type: 'count', at: event.occurredAt, countedValue: counted, quantity: event.quantity }
      : { ...event, at: event.occurredAt };
  }));
  next.countSessions = saved.countSessions || [];
  return next;
}

// Saved data lives in IndexedDB, which holds hundreds of megabytes (years of sales).
// localStorage (about 5 MB) is only a fallback for browsers without IndexedDB.
const DB_NAME = 'empowering-brew';
const STORE = 'state';
const RECORD = 'current';
let database = null;
let backend = 'indexeddb';
let pendingSave = Promise.resolve();

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer version of the app upgrade the database; the next save reopens it.
      db.onversionchange = () => { db.close(); database = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function storeRequest(mode, run) {
  database ??= openDatabase();
  return database.then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = transaction.onabort = () => reject(transaction.error);
  }));
}

// Turns saved text into app state. Unreadable data is kept, never overwritten.
async function readSaved(text) {
  if (text == null) return cloneInitialState();
  try {
    const parsed = JSON.parse(text);
    if (![2, SCHEMA_VERSION].includes(parsed?.schemaVersion)) throw new Error('Unknown schema');
    return migrate(parsed);
  } catch {
    const copyKey = `unreadable-${Date.now()}`;
    try { await storeRequest('readwrite', (store) => store.put(text, copyKey)); } catch {
      try { localStorage.setItem(`${KEY}-${copyKey}`, text); } catch { /* storage full or blocked */ }
    }
    return cloneInitialState();
  }
}

export async function loadState() {
  let text;
  try {
    text = await storeRequest('readonly', (store) => store.get(RECORD));
  } catch {
    backend = 'localstorage';
    try { return await readSaved(localStorage.getItem(KEY)); } catch { return cloneInitialState(); }
  }
  if (text !== undefined) return readSaved(text);
  // First open since the move to IndexedDB: carry over what localStorage holds.
  let legacy = null;
  try { legacy = localStorage.getItem(KEY); } catch { /* blocked */ }
  const state = await readSaved(legacy);
  if (legacy != null && await saveState(state)) {
    // Keep the old copy under another name so it is recoverable but never loaded again.
    try { localStorage.setItem(`${KEY}-before-indexeddb`, legacy); localStorage.removeItem(KEY); } catch { /* leave it in place */ }
  }
  return state;
}

// Resolves true once the state is safely stored, false if it could not be saved.
// Saves run one after another so an older state never lands after a newer one.
export function saveState(state) {
  const text = JSON.stringify(state);
  pendingSave = pendingSave.then(async () => {
    if (backend === 'indexeddb') {
      try { await storeRequest('readwrite', (store) => store.put(text, RECORD)); return true; } catch { return false; }
    }
    try { localStorage.setItem(KEY, text); return true; } catch { return false; }
  });
  return pendingSave;
}

// For the Backups panel: where data is kept and whether the browser may clear it.
export async function storageStatus() {
  const [persisted, estimate] = await Promise.all([
    navigator.storage?.persisted?.().catch(() => null) ?? null,
    navigator.storage?.estimate?.().catch(() => null) ?? null,
  ]);
  return { backend, persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}

export async function hashPin(pin) {
  const bytes = new TextEncoder().encode(`empowering-brew:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
