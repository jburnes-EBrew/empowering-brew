import { SCHEMA_VERSION, SEED_VERSION_LABEL, cloneInitialState } from './data';

const KEY = 'empowering-brew-state-v1';

// Upgrades saved data in place. Sales, inventory events, count sessions and the
// staff PIN are always carried forward; nothing recorded on the iPad is discarded.
export function migrate(saved) {
  if (saved?.schemaVersion === SCHEMA_VERSION) return {
    ...saved,
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

export function loadState() {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
    if (!saved) return cloneInitialState();
    const parsed = JSON.parse(saved);
    if (![2, SCHEMA_VERSION].includes(parsed?.schemaVersion)) throw new Error('Unknown schema');
    return migrate(parsed);
  } catch {
    // Keep unreadable data instead of overwriting it, so it can be recovered.
    try { if (saved) localStorage.setItem(`${KEY}-unreadable-${Date.now()}`, saved); } catch { /* storage full or blocked */ }
    return cloneInitialState();
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked; state stays in memory */ }
}

export async function hashPin(pin) {
  const bytes = new TextEncoder().encode(`empowering-brew:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
