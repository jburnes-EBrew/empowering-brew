import { SHOP_HOURS } from './data';

const round = (value) => Math.round(value * 1000) / 1000;
export const formatNumber = (value) => value == null || Number.isNaN(value) ? '—' : String(round(value));
export const formatRange = (amount, unit) => !amount ? 'Not specified' : `${amount.min === amount.max ? amount.min : `${amount.min}-${amount.max}`}${unit ? ` ${unit}${unit === 'pump' || unit === 'shot' ? (amount.max === 1 ? '' : 's') : ''}` : ''}`;

export const currentRecipe = (recipes, recipeKey) => recipeKey ? recipes.find((recipe) => recipe.recipeKey === recipeKey && !recipe.supersededAt) || null : null;
export const recipeHistory = (recipes, recipeKey) => recipes.filter((recipe) => recipe.recipeKey === recipeKey).sort((a, b) => b.version - a.version);

// The amount used for inventory math: a fixed card amount, or the staff-chosen
// standard amount when the card gives a range.
export function lineQuantity(line) {
  if (!line.amount) return null;
  if (line.amount.min === line.amount.max) return line.amount.min;
  return line.calcAmount ?? null;
}

// Lines with `forOptions` apply only when the sale's option (e.g. a latte flavor) is one
// of them. With no option given (recipe screens), every line is checked for missing
// details but only the lines used by every sale are counted as usage.
export const lineApplies = (entry, option) => !entry.forOptions?.length || entry.forOptions.includes(option);

// Changes a customer can ask for at the register. Toppings come off by name; an extra
// shot adds one espresso shot; soy milk takes the milk from Soy Milk instead.
// A sale's changes adjust its inventory estimate, not its price.
export const EXTRA_SHOT = 'Extra shot';
export const SOY_MILK = 'Soy milk';
const noLabel = (entry) => `No ${entry.label.toLowerCase()}`;
const SOY_ITEM = 'soy-milk';
const isShot = (entry) => entry.role === 'espresso' && entry.unit === 'shot'; // brewed coffee grounds share the role

// Additions match the flavored latte: each flavor's syrup and each topping, copied from
// that recipe so staff edits to pumps and amounts carry over.
export function latteAdditions(latte) {
  if (!latte) return [];
  const lines = latte.lines.filter((entry) => !entry.excluded && (entry.role === 'syrup' || entry.role === 'topping'));
  const additions = [...lines.filter((entry) => entry.role === 'syrup'), ...lines.filter((entry) => entry.role === 'topping')].map((entry) => {
    const name = (entry.role === 'syrup' && entry.forOptions?.length ? entry.forOptions[0].replace(/ \+ .*$/, '') : entry.label).toLowerCase();
    const { forOptions, ...rest } = entry;
    return { name: `Add ${name}`, line: { ...rest, id: `add-${entry.id}` } };
  });
  return additions.filter((entry, index) => additions.findIndex((other) => other.name === entry.name) === index);
}

export function changeChoices(recipe, option, inventory, { toppings = true, additions = [] } = {}) {
  const lines = recipe ? recipe.lines.filter((entry) => !entry.excluded && lineApplies(entry, option)) : [];
  const has = (line) => lines.some((entry) => line.itemId ? entry.itemId === line.itemId : entry.label === line.label);
  const remove = toppings ? lines.filter((entry) => entry.role === 'topping').map(noLabel) : [];
  const add = additions.filter((entry) => (toppings || entry.line.role !== 'topping') && !has(entry.line)).map((entry) => entry.name);
  if (lines.some(isShot)) add.push(EXTRA_SHOT);
  if (lines.some((entry) => entry.role === 'milk' && entry.itemId !== SOY_ITEM) && inventory.some((item) => item.id === SOY_ITEM && item.active)) add.push(SOY_MILK);
  return { remove: [...new Set(remove)], add: [...new Set(add)] };
}
export function withChanges(recipe, changes = [], additions = []) {
  if (!recipe || !changes.length) return recipe;
  const lines = recipe.lines.filter((entry) => !(entry.role === 'topping' && changes.includes(noLabel(entry)))).map((entry) => {
    if (isShot(entry) && changes.includes(EXTRA_SHOT) && entry.amount) {
      return { ...entry, amount: { min: entry.amount.min + 1, max: entry.amount.max + 1 }, calcAmount: entry.calcAmount == null ? null : entry.calcAmount + 1 };
    }
    if (entry.role === 'milk' && changes.includes(SOY_MILK)) return { ...entry, itemId: SOY_ITEM, itemConfirmed: true };
    return entry;
  });
  const added = additions.filter((entry) => changes.includes(entry.name)).map((entry) => entry.line);
  return { ...recipe, lines: [...lines, ...added] };
}

// Recipe units converted to ounces with a per-item setting before counting against inventory.
export const MEASURES = {
  pump: { field: 'ozPerPump', missing: 'pump volume not measured' },
  shot: { field: 'ozPerShot', missing: 'ground coffee per shot not set' },
  Tbs: { field: 'ozPerTbs', missing: 'ounces per tablespoon not set' },
};

export function estimateUsage(recipe, inventory, option) {
  if (!recipe) return { status: 'not-configured', usage: [], gaps: ['No recipe linked to this product'] };
  const usage = [];
  const gaps = [];
  const anyOption = option === undefined;
  for (const entry of recipe.lines) {
    if (entry.excluded) continue;
    if (!anyOption && !lineApplies(entry, option)) continue;
    const countUsage = !anyOption || !entry.forOptions?.length;
    const quantity = lineQuantity(entry);
    if (quantity == null) {
      gaps.push(entry.amount ? `${entry.label}: choose a standard amount within ${formatRange(entry.amount, entry.unit)}` : `${entry.label}: quantity not specified`);
      continue;
    }
    const item = entry.itemConfirmed ? inventory.find((candidate) => candidate.id === entry.itemId) : null;
    if (!item) { gaps.push(`${entry.label}: inventory item not confirmed`); continue; }
    let amount = quantity;
    let unit = entry.unit;
    const measure = MEASURES[unit];
    if (measure && item.usageUnit !== unit) {
      const ounces = (unit === 'pump' ? entry.ozPerPump : null) ?? item[measure.field];
      if (!ounces) { gaps.push(`${entry.label}: ${measure.missing} for ${item.name}`); continue; }
      amount = quantity * ounces;
      unit = 'oz';
    }
    if (!countUsage) continue;
    usage.push({ itemId: item.id, itemName: item.name, quantity: round(amount), unit: unit || 'each' });
  }
  return { status: gaps.length ? (usage.length ? 'partial' : 'incomplete') : 'complete', usage, gaps };
}

export const ESTIMATE_LABELS = { complete: 'Estimate complete', partial: 'Partial estimate', incomplete: 'Recipe needs setup', 'not-configured': 'Not configured' };

// Balance per item = latest absolute count (opening or reconciled physical count)
// + restocks/waste/adjustments after it − converted recipe usage after it.
// Usage that cannot be converted to the item's count unit is reported, not guessed.
export function inventoryBalances(state) {
  const balances = {};
  for (const item of state.inventory) {
    const anchors = state.inventoryEvents.filter((event) => event.itemId === item.id && event.countedValue != null).sort((a, b) => a.at.localeCompare(b.at));
    const anchor = anchors.at(-1);
    balances[item.id] = { estimate: anchor ? anchor.countedValue : 0, anchorAt: anchor?.at || null, lastCountAt: anchor?.type === 'count' ? anchor.at : null, unconverted: {} };
  }
  const after = (balance, at) => !balance.anchorAt || at > balance.anchorAt;
  for (const event of state.inventoryEvents) {
    const balance = balances[event.itemId];
    if (balance && event.countedValue == null && typeof event.quantity === 'number' && after(balance, event.at)) balance.estimate += event.quantity;
  }
  const usages = [
    ...state.sales.filter((sale) => !sale.voidedAt).flatMap((sale) => (sale.usage || []).map((use) => ({ ...use, at: sale.soldAt }))),
    ...state.inventoryEvents.flatMap((event) => (event.usage || []).map((use) => ({ ...use, at: event.at }))),
  ];
  for (const use of usages) {
    const balance = balances[use.itemId];
    const item = state.inventory.find((entry) => entry.id === use.itemId);
    if (!balance || !after(balance, use.at)) continue;
    if (item.usageUnit && item.usageUnit === use.unit && item.usagePerCount > 0) balance.estimate -= use.quantity / item.usagePerCount;
    else balance.unconverted[use.unit] = round((balance.unconverted[use.unit] || 0) + use.quantity);
  }
  for (const balance of Object.values(balances)) balance.estimate = round(balance.estimate);
  return balances;
}

export const weekStart = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

// Reports cover open days only; a sale on a closed day (such as a practice day) is left out.
export const onOpenDay = (sale) => SHOP_HOURS.days.includes((new Date(sale.soldAt).getDay() + 6) % 7);

export function weeklyReport(state, startDate) {
  const start = weekStart(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const sales = state.sales.filter((sale) => !sale.voidedAt && onOpenDay(sale) && new Date(sale.soldAt) >= start && new Date(sale.soldAt) < end);
  const dayIndex = (iso) => (new Date(iso).getDay() + 6) % 7;
  const order = Object.fromEntries(state.menuItems.map((entry) => [entry.id, entry.order]));
  const tempOrder = { hot: 0, iced: 1, none: 2 };
  const rows = state.products
    .filter((product) => product.active || sales.some((sale) => sale.productId === product.id))
    .sort((a, b) => (order[a.menuItemId] ?? 999) - (order[b.menuItemId] ?? 999) || tempOrder[a.temperature] - tempOrder[b.temperature])
    .map((product) => {
      const days = Array(7).fill(0);
      sales.filter((sale) => sale.productId === product.id).forEach((sale) => { days[dayIndex(sale.soldAt)] += 1; });
      return { product, days, total: days.reduce((sum, value) => sum + value, 0) };
    });
  const usage = {};
  for (const sale of sales) for (const use of sale.usage || []) {
    const key = `${use.itemId}|${use.unit}`;
    usage[key] = { itemName: use.itemName, unit: use.unit, quantity: round((usage[key]?.quantity || 0) + use.quantity) };
  }
  return { start, end, sales, rows, usage: Object.values(usage).sort((a, b) => a.itemName.localeCompare(b.itemName)), withoutFullEstimate: sales.filter((sale) => sale.estimateStatus !== 'complete').length };
}

// Busy times: sales counted per weekday and time slot (local time on this iPad),
// for planning staffing and prep. Only the slots between the first and last sale are shown.
// With hours, every slot from opening to closing is listed; sales outside hours still add rows.
export function busyTimes(sales, slotMinutes = 30, hours = null) {
  const counted = sales.filter((sale) => !sale.voidedAt);
  const slotOf = (date) => Math.floor((date.getHours() * 60 + date.getMinutes()) / slotMinutes);
  const cells = new Map();
  for (const sale of counted) {
    const at = new Date(sale.soldAt);
    const key = `${slotOf(at)}|${(at.getDay() + 6) % 7}`;
    cells.set(key, (cells.get(key) || 0) + 1);
  }
  if (!cells.size) return { slots: [], max: 0, busiest: null, total: 0 };
  const slotNumbers = [...cells.keys()].map((key) => Number(key.split('|')[0]));
  if (hours) slotNumbers.push(Math.floor(hours.openMinutes / slotMinutes), Math.ceil(hours.closeMinutes / slotMinutes) - 1);
  const slots = [];
  for (let slot = Math.min(...slotNumbers); slot <= Math.max(...slotNumbers); slot += 1) {
    const days = Array.from({ length: 7 }, (_, day) => cells.get(`${slot}|${day}`) || 0);
    slots.push({ startMinutes: slot * slotMinutes, days, total: days.reduce((sum, count) => sum + count, 0) });
  }
  let busiest = null;
  for (const slot of slots) slot.days.forEach((count, day) => { if (count && (!busiest || count > busiest.count)) busiest = { startMinutes: slot.startMinutes, day, count }; });
  return { slots, max: busiest.count, busiest, total: counted.length, slotMinutes };
}

export const clockLabel = (minutes) => {
  const hours = Math.floor(minutes / 60) % 24;
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
};
