import { describe, expect, it } from 'vitest';
import { cloneInitialState } from './data';
import { currentRecipe, estimateUsage, inventoryBalances } from './estimates';
import { migrate } from './storage';
import { WORKSHEET_UPDATE, applyWorksheetUpdate } from './updates';

const fresh = () => migrate(cloneInitialState('2026-10-01T00:00:00.000Z'));
const product = (state, id) => state.products.find((entry) => entry.id === id);
const recipeFor = (state, id) => currentRecipe(state.recipes, product(state, id).recipeKey);
const used = (estimate) => Object.fromEntries(estimate.usage.map((use) => [use.itemName, `${use.quantity} ${use.unit}`]));

describe('worksheet update', () => {
  it('keeps the card version as history and adds the worksheet version', () => {
    const state = fresh();
    const versions = state.recipes.filter((recipe) => recipe.recipeKey === 'panther-paw-hot');
    expect(versions.map((recipe) => [recipe.version, !!recipe.supersededAt])).toEqual([[1, true], [2, false]]);
  });

  it('turns a Panther Paw sale into worksheet amounts', () => {
    const state = fresh();
    const estimate = estimateUsage(recipeFor(state, 'panther-paw-iced'), state.inventory, null);
    expect(used(estimate)).toEqual({ 'Cold cups': '1 each', 'Classic Caramel Syrup': '0.75 oz', 'Vanilla Syrup': '0.25 oz', 'Whole Milk': '6.9 oz', Ice: '2 oz', Whip: '4 Tbs', 'Caramel Drizzle': '2 Tbs' });
    expect(estimate.gaps).toEqual(expect.arrayContaining(['Cold cup lid: quantity not specified', 'Espresso: ground coffee per shot not set for Coffee Reg']));
  });

  it('uses only the chosen flavor syrup and drizzle on a flavored latte', () => {
    const state = fresh();
    const recipe = recipeFor(state, 'latte-flavored-hot');
    const caramel = used(estimateUsage(recipe, state.inventory, 'Caramel'));
    expect(caramel['Classic Caramel Syrup']).toBe('0.75 oz');
    expect(caramel['Caramel Drizzle']).toBe('2 Tbs');
    expect(caramel['Vanilla Syrup']).toBeUndefined();
    const vanilla = estimateUsage(recipe, state.inventory, 'Vanilla + chocolate drizzle');
    expect(used(vanilla)['Vanilla Syrup']).toBe('0.75 oz');
    expect(used(vanilla)['Caramel Drizzle']).toBeUndefined();
    expect(vanilla.gaps).toContain('Chocolate drizzle: inventory item not confirmed');
  });

  it('adds whip to a plain latte only when chosen', () => {
    const state = fresh();
    const recipe = recipeFor(state, 'latte-plain-iced');
    expect(used(estimateUsage(recipe, state.inventory, 'No topping')).Whip).toBeUndefined();
    expect(used(estimateUsage(recipe, state.inventory, 'Whipped topping')).Whip).toBe('4 Tbs');
    expect(product(state, 'latte-plain-iced').options).toContain('No topping');
  });

  it('deducts converted amounts from inventory', () => {
    const state = fresh();
    const sale = { id: 's', productId: 'latte-plain-hot', soldAt: '2026-10-28T10:00:00.000Z', usage: estimateUsage(recipeFor(state, 'latte-plain-hot'), state.inventory, 'No topping').usage };
    const balances = inventoryBalances({ ...state, sales: [sale] });
    expect(balances['whole-milk'].estimate).toBeCloseTo(3 - 6.9 / 128, 3);
    expect(balances['hot-cups'].estimate).toBeCloseTo(0.5 - 1 / 25, 3);
  });

  it('adds iced Black Coffee and fills units', () => {
    const state = fresh();
    expect(product(state, 'black-coffee-iced')).toMatchObject({ temperature: 'iced', active: true });
    expect(state.inventory.find((item) => item.id === 'ice')).toMatchObject({ countUnit: 'bag', usageUnit: 'oz', usagePerCount: 320 });
    expect(state.inventory.find((item) => item.id === 'vanilla-syrup')).toMatchObject({ usagePerCount: 24.5, ozPerPump: 0.25 });
  });

  it('never overwrites what staff already changed, and runs once', () => {
    const base = migrate({ ...cloneInitialState(), settings: { appliedUpdates: [] } });
    const edited = cloneInitialState();
    edited.inventory = edited.inventory.map((item) => item.id === 'whole-milk' ? { ...item, countUnit: 'half gallon', usageUnit: 'oz', usagePerCount: 64 } : item);
    edited.recipes = edited.recipes.map((recipe) => recipe.recipeKey === 'rock-chalk-hot' ? { ...recipe, versionId: 'rock-chalk-hot-v2-custom' } : recipe);
    const updated = applyWorksheetUpdate(edited);
    expect(updated.inventory.find((item) => item.id === 'whole-milk').usagePerCount).toBe(64);
    expect(updated.recipes.filter((recipe) => recipe.recipeKey === 'rock-chalk-hot')).toHaveLength(1);
    expect(applyWorksheetUpdate(updated)).toBe(updated);
    expect(base.settings.appliedUpdates).toEqual([WORKSHEET_UPDATE]);
  });
});
