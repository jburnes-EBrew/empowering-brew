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

export function estimateUsage(recipe, inventory) {
  if (!recipe) return { status: 'not-configured', usage: [], gaps: ['No recipe linked to this product'] };
  const usage = [];
  const gaps = [];
  for (const entry of recipe.lines) {
    if (entry.excluded) continue;
    const quantity = lineQuantity(entry);
    if (quantity == null) {
      gaps.push(entry.amount ? `${entry.label}: choose a standard amount within ${formatRange(entry.amount, entry.unit)}` : `${entry.label}: quantity not specified`);
      continue;
    }
    const item = entry.itemConfirmed ? inventory.find((candidate) => candidate.id === entry.itemId) : null;
    if (!item) { gaps.push(`${entry.label}: inventory item not confirmed`); continue; }
    let amount = quantity;
    let unit = entry.unit;
    if (unit === 'pump') {
      const ounces = entry.ozPerPump ?? item.ozPerPump;
      if (!ounces) { gaps.push(`${entry.label}: pump volume not measured for ${item.name}`); continue; }
      amount = quantity * ounces;
      unit = 'oz';
    }
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

export function weeklyReport(state, startDate) {
  const start = weekStart(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const sales = state.sales.filter((sale) => !sale.voidedAt && new Date(sale.soldAt) >= start && new Date(sale.soldAt) < end);
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
