import { describe, expect, it } from 'vitest';
import { cloneInitialState } from './data';
import { bakeryReport, reorderList, busyTimes, clockLabel, estimateUsage, inventoryBalances, weeklyReport } from './estimates';
import { migrate } from './storage';

const configured = () => {
  const state = cloneInitialState('2026-10-01T00:00:00.000Z');
  state.inventory = state.inventory.map((item) => {
    if (item.id === 'vanilla-syrup') return { ...item, ozPerPump: 0.25, usageUnit: 'oz', usagePerCount: 25 };
    if (item.id === 'whole-milk') return { ...item, usageUnit: 'oz', usagePerCount: 128 };
    return item;
  });
  const recipe = state.recipes.find((entry) => entry.recipeKey === 'panther-paw-hot');
  recipe.lines = recipe.lines.map((line) => {
    if (line.label === 'Vanilla syrup') return { ...line, itemConfirmed: true };
    if (line.role === 'milk') return { ...line, itemConfirmed: true, calcAmount: 9 };
    return { ...line, excluded: true };
  });
  return { state, recipe };
};

describe('ingredient estimates', () => {
  it('uses the staff standard amount for ranges and the measured pump volume', () => {
    const { state, recipe } = configured();
    const result = estimateUsage(recipe, state.inventory);
    expect(result.status).toBe('complete');
    expect(result.usage).toEqual([
      { itemId: 'vanilla-syrup', itemName: 'Vanilla Syrup', quantity: 0.25, unit: 'oz' },
      { itemId: 'whole-milk', itemName: 'Whole Milk', quantity: 9, unit: 'oz' },
    ]);
  });

  it('allows a per-recipe pump volume override', () => {
    const { state, recipe } = configured();
    recipe.lines = recipe.lines.map((line) => line.label === 'Vanilla syrup' ? { ...line, ozPerPump: 0.5 } : line);
    expect(estimateUsage(recipe, state.inventory).usage[0].quantity).toBe(0.5);
  });

  it('reports gaps instead of guessing', () => {
    const { state, recipe } = configured();
    recipe.lines = recipe.lines.map((line) => line.role === 'milk' ? { ...line, calcAmount: null } : line.role === 'topping' ? { ...line, excluded: false } : line);
    const result = estimateUsage(recipe, state.inventory);
    expect(result.status).toBe('partial');
    expect(result.gaps).toContain('Steamed milk: choose a standard amount within 8-10 oz');
    expect(result.gaps).toContain('Whipped cream: quantity not specified');
  });

  it('marks products without a recipe as not configured', () => {
    expect(estimateUsage(null, []).status).toBe('not-configured');
  });
});

describe('inventory balances', () => {
  it('deducts converted usage, applies events, and re-anchors on physical counts', () => {
    const { state } = configured();
    state.sales.push({ id: 's1', productId: 'panther-paw-hot', soldAt: '2026-10-02T10:00:00.000Z', usage: [{ itemId: 'whole-milk', itemName: 'Whole Milk', quantity: 64, unit: 'oz' }] });
    state.sales.push({ id: 's2', productId: 'panther-paw-hot', soldAt: '2026-10-02T10:05:00.000Z', voidedAt: '2026-10-02T10:05:10.000Z', usage: [{ itemId: 'whole-milk', itemName: 'Whole Milk', quantity: 64, unit: 'oz' }] });
    state.inventoryEvents.push({ id: 'r1', type: 'restock', itemId: 'whole-milk', quantity: 2, at: '2026-10-03T00:00:00.000Z' });
    expect(inventoryBalances(state)['whole-milk'].estimate).toBe(4.5);
    state.inventoryEvents.push({ id: 'c1', type: 'count', itemId: 'whole-milk', countedValue: 4, quantity: -0.5, at: '2026-10-04T00:00:00.000Z' });
    expect(inventoryBalances(state)['whole-milk'].estimate).toBe(4);
  });

  it('keeps usage it cannot convert visible instead of deducting it', () => {
    const { state } = configured();
    state.sales.push({ id: 's1', soldAt: '2026-10-02T10:00:00.000Z', usage: [{ itemId: 'hot-cups', itemName: 'Hot cups', quantity: 1, unit: 'each' }] });
    const balance = inventoryBalances(state)['hot-cups'];
    expect(balance.estimate).toBe(0.5);
    expect(balance.unconverted).toEqual({ each: 1 });
  });
});

describe('reports and migration', () => {
  it('counts hot and iced variants separately by weekday', () => {
    const state = cloneInitialState();
    state.sales = [
      { id: 'a', productId: 'black-panther-hot', soldAt: '2026-10-26T15:00:00', estimateStatus: 'not-configured' },
      { id: 'b', productId: 'black-panther-iced', soldAt: '2026-10-27T15:00:00', estimateStatus: 'not-configured' },
      { id: 'c', productId: 'black-panther-iced', soldAt: '2026-10-27T15:01:00', estimateStatus: 'not-configured' },
    ];
    const report = weeklyReport(state, new Date('2026-10-28T12:00:00'));
    expect(report.rows.find((row) => row.product.id === 'black-panther-hot').days.slice(0, 2)).toEqual([1, 0]);
    expect(report.rows.find((row) => row.product.id === 'black-panther-iced').days.slice(0, 2)).toEqual([0, 2]);
  });

  it('adds bakery excess to sold to show how many were made', () => {
    const state = cloneInitialState();
    state.sales = [
      { id: 't1', productId: 'bakery-sweet-treat', menuItemId: 'sweet-treat', soldAt: '2026-10-27T11:00:00', estimateStatus: 'not-configured' },
      { id: 't2', productId: 'bakery-sweet-treat', menuItemId: 'sweet-treat', soldAt: '2026-10-27T12:00:00', estimateStatus: 'not-configured' },
      { id: 'd', productId: 'black-panther-hot', menuItemId: 'black-panther', soldAt: '2026-10-27T12:00:00', estimateStatus: 'not-configured' },
    ];
    state.inventoryEvents.push({ id: 'x', type: 'bakery-excess', count: 3, forDate: '2026-10-27', at: '2026-10-28T09:00:00.000Z' });
    state.inventoryEvents.push({ id: 'y', type: 'bakery-excess', count: 5, forDate: '2026-11-03', at: '2026-11-03T15:00:00.000Z' });
    const bakery = bakeryReport(state, weeklyReport(state, new Date('2026-10-28T12:00:00')));
    expect(bakery.sold[1]).toBe(2);
    expect(bakery.excess).toEqual([0, 3, 0, 0, 0, 0, 0]);
    expect(bakery.made[1]).toBe(5);
  });

  it('lists items below par with the amount to order', () => {
    const state = cloneInitialState();
    const rows = reorderList(state, ['Coffee & bar', 'Milk & cream']);
    const reg = rows.find((row) => row.item.id === 'coffee-reg');
    expect(reg).toMatchObject({ estimate: 0, need: 6, order: 6 });
    expect(rows.find((row) => row.item.id === 'whole-milk')).toBeUndefined(); // 3 on hand, par 3
    state.inventoryEvents.push({ id: 'c', type: 'count', itemId: 'whole-milk', countedValue: 1.25, at: '2099-01-01T00:00:00.000Z' });
    expect(reorderList(state, []).find((row) => row.item.id === 'whole-milk')).toMatchObject({ need: 1.75, order: 2 });
    expect(rows[0].item.category).toBe('Coffee & bar');
  });

  it('leaves out sales on closed days', () => {
    const state = cloneInitialState();
    state.sales = [
      { id: 'a', productId: 'black-panther-hot', soldAt: '2026-10-27T11:00:00', estimateStatus: 'not-configured', price: 3.5 },
      { id: 'w', productId: 'black-panther-hot', soldAt: '2026-10-28T11:00:00', estimateStatus: 'not-configured', price: 3.5 },
    ];
    const report = weeklyReport(state, new Date('2026-10-28T12:00:00'));
    expect(report.sales.map((sale) => sale.id)).toEqual(['a']);
    expect(report.rows.find((row) => row.product.id === 'black-panther-hot').days[2]).toBe(0);
  });

  it('carries version 2 sales and PIN forward', () => {
    const next = migrate({ schemaVersion: 2, staffPinHash: 'abc', sales: [{ id: 'x', productId: 'bakery-sweet-treat', temperature: 'other', modifier: null, soldAt: '2026-10-27T12:00:00.000Z' }], inventoryEvents: [{ id: 'e', type: 'reconciliation', itemId: 'ice', quantity: -1, occurredAt: '2026-10-27T13:00:00.000Z', note: 'Physical count 1; prior balance 2' }], countSessions: [] });
    expect(next.schemaVersion).toBe(3);
    expect(next.staffPinHash).toBe('abc');
    expect(next.sales[0]).toMatchObject({ id: 'x', temperature: 'none', menuItemId: 'sweet-treat', estimateStatus: 'not-configured' });
    expect(inventoryBalances(next).ice.estimate).toBe(1);
  });
});

describe('busy times', () => {
  it('counts sales by weekday and half hour, skipping undone sales', () => {
    const sale = (iso, extra = {}) => ({ soldAt: new Date(iso).toISOString(), ...extra });
    const result = busyTimes([
      sale('2026-11-02T07:40:00'), sale('2026-11-02T07:55:00'), sale('2026-11-02T08:05:00'),
      sale('2026-11-03T07:45:00'), sale('2026-11-02T07:50:00', { voidedAt: 'x' }),
    ]);
    expect(result.total).toBe(4);
    expect(result.slots.map((slot) => clockLabel(slot.startMinutes))).toEqual(['7:30 AM', '8:00 AM']);
    expect(result.slots[0].days.slice(0, 2)).toEqual([2, 1]);
    expect(result.busiest).toEqual({ startMinutes: 450, day: 0, count: 2 });
    expect(busyTimes([]).slots).toEqual([]);
  });

  it('lists every open-hours slot and keeps sales outside them', () => {
    const hours = { days: [0, 1, 3, 4], openMinutes: 600, closeMinutes: 840 };
    const at = (iso) => ({ soldAt: new Date(iso).toISOString() });
    const labels = (result) => result.slots.map((slot) => clockLabel(slot.startMinutes));
    expect(labels(busyTimes([at('2026-11-02T11:10:00')], 60, hours))).toEqual(['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM']);
    const late = busyTimes([at('2026-11-02T11:10:00'), at('2026-11-02T14:20:00')], 30, hours);
    expect(labels(late)[0]).toBe('10:00 AM');
    expect(labels(late).at(-1)).toBe('2:00 PM');
  });
});
