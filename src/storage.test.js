import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { SCHEMA_VERSION, cloneInitialState } from './data';

const KEY = 'empowering-brew-state-v1';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.has(key) ? items.get(key) : null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    keys: () => [...items.keys()],
  };
}

// Each test gets a fresh iPad: empty IndexedDB, empty localStorage, freshly loaded module.
async function freshDevice({ indexedDB = new IDBFactory() } = {}) {
  vi.resetModules();
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('localStorage', memoryStorage());
  return import('./storage');
}

describe('saved data', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('starts with the seed menu on a new device', async () => {
    const { loadState } = await freshDevice();
    const state = await loadState();
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.sales).toEqual([]);
  });

  it('keeps sales across app restarts', async () => {
    const idb = new IDBFactory();
    let storage = await freshDevice({ indexedDB: idb });
    const state = await storage.loadState();
    expect(await storage.saveState({ ...state, sales: [{ id: 'sale-1', soldAt: '2026-10-27T15:00:00.000Z' }] })).toBe(true);
    storage = await freshDevice({ indexedDB: idb });
    expect((await storage.loadState()).sales.map((sale) => sale.id)).toEqual(['sale-1']);
  });

  it('moves existing localStorage data into IndexedDB and keeps the old copy aside', async () => {
    const idb = new IDBFactory();
    let storage = await freshDevice({ indexedDB: idb });
    const old = { ...cloneInitialState(), sales: [{ id: 'old-sale', soldAt: '2026-10-01T15:00:00.000Z' }] };
    localStorage.setItem(KEY, JSON.stringify(old));
    expect((await storage.loadState()).sales.map((sale) => sale.id)).toEqual(['old-sale']);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(`${KEY}-before-indexeddb`)).sales).toHaveLength(1);
    storage = await freshDevice({ indexedDB: idb });
    expect((await storage.loadState()).sales.map((sale) => sale.id)).toEqual(['old-sale']);
  });

  it('saves changes in the order they were made', async () => {
    const idb = new IDBFactory();
    let storage = await freshDevice({ indexedDB: idb });
    const state = await storage.loadState();
    const saves = [1, 2, 3].map((count) => storage.saveState({ ...state, sales: Array.from({ length: count }, (_, i) => ({ id: `s${i}`, soldAt: '2026-10-27T15:00:00.000Z' })) }));
    await Promise.all(saves);
    storage = await freshDevice({ indexedDB: idb });
    expect((await storage.loadState()).sales).toHaveLength(3);
  });

  it('keeps unreadable data instead of overwriting it', async () => {
    const storage = await freshDevice();
    localStorage.setItem(KEY, '{not json');
    const state = await storage.loadState();
    expect(state.sales).toEqual([]);
    expect(localStorage.getItem(`${KEY}-before-indexeddb`)).toBe('{not json');
  });

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    const storage = await freshDevice({ indexedDB: { open: () => { throw new Error('blocked'); } } });
    const state = await storage.loadState();
    expect(await storage.saveState({ ...state, sales: [{ id: 'x', soldAt: '2026-10-27T15:00:00.000Z' }] })).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)).sales).toHaveLength(1);
  });
});

describe('flavor note update', () => {
  it('replaces the old flavored-latte note on devices already in use', async () => {
    const { migrate } = await import('./storage');
    const { FLAVOR_NOTE } = await import('./data');
    const saved = cloneInitialState();
    saved.menuItems = saved.menuItems.map((item) => item.id === 'cafe-latte-flavored' ? { ...item, reviewNote: 'Workbook does not say which flavor or how much; flavor is recorded as a sale option only.' } : item);
    expect(migrate(saved).menuItems.find((item) => item.id === 'cafe-latte-flavored').reviewNote).toBe(FLAVOR_NOTE);
  });
});
