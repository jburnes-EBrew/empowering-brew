import { describe, expect, it } from 'vitest';
import { cloneInitialState } from './data';
import { currentRecipe, estimateUsage, inventoryBalances } from './estimates';
import { migrate } from './storage';
import { ANSWERS_UPDATE, WORKSHEET_UPDATE, applyAnswersUpdate, applyWorksheetUpdate } from './updates';

const fresh = () => migrate(cloneInitialState('2026-10-01T00:00:00.000Z'));
const product = (state, id) => state.products.find((entry) => entry.id === id);
const recipeFor = (state, id) => currentRecipe(state.recipes, product(state, id).recipeKey);
const used = (estimate) => Object.fromEntries(estimate.usage.map((use) => [use.itemName, `${use.quantity} ${use.unit}`]));

describe('worksheet and owner-answer updates', () => {
  it('keeps the card and worksheet versions as history', () => {
    const versions = fresh().recipes.filter((recipe) => recipe.recipeKey === 'panther-paw-hot');
    expect(versions.map((recipe) => [recipe.versionLabel, !!recipe.supersededAt])).toEqual([['Recipe cards v1', true], ['Setup worksheet (Oct 2026)', true], ['Owner answers (Oct 2026)', false]]);
  });

  it('gives every signature drink a complete estimate', () => {
    const state = fresh();
    const estimate = estimateUsage(recipeFor(state, 'panther-paw-iced'), state.inventory, null);
    expect(estimate.status).toBe('complete');
    expect(used(estimate)).toEqual({ 'Cold cups': '1 each', 'Coffee Reg': '0.98 oz', 'Classic Caramel Syrup': '0.75 oz', 'Vanilla Syrup': '0.25 oz', 'Whole Milk': '6.9 oz', Ice: '2 oz', Whip: '0.352 oz', 'Caramel Drizzle': '1.38 oz' });
    const black = estimateUsage(recipeFor(state, 'black-panther-hot'), state.inventory, null);
    expect(black.status).toBe('complete');
    expect(used(black)['Chocolate syrup']).toBe('1 oz');
  });

  it('uses only the chosen flavor syrup and drizzle on a flavored latte', () => {
    const state = fresh();
    const recipe = recipeFor(state, 'latte-flavored-hot');
    const caramel = used(estimateUsage(recipe, state.inventory, 'Caramel'));
    expect(caramel['Classic Caramel Syrup']).toBe('0.75 oz');
    expect(caramel['Caramel Drizzle']).toBe('1.38 oz');
    expect(caramel['Vanilla Syrup']).toBeUndefined();
    const vanilla = estimateUsage(recipe, state.inventory, 'Vanilla + chocolate drizzle');
    expect(vanilla.status).toBe('complete');
    expect(used(vanilla)).toMatchObject({ 'Vanilla Syrup': '0.75 oz', 'Dark Ch Drizzle': '1.38 oz' });
    expect(used(vanilla)['Caramel Drizzle']).toBeUndefined();
  });

  it('adds whip to a plain latte only when chosen', () => {
    const state = fresh();
    const recipe = recipeFor(state, 'latte-plain-iced');
    expect(used(estimateUsage(recipe, state.inventory, 'No topping')).Whip).toBeUndefined();
    expect(used(estimateUsage(recipe, state.inventory, 'Whipped topping')).Whip).toBe('0.352 oz');
  });

  it('has recipes for iced espresso and both black coffees; only tea bags are still missing', () => {
    const state = fresh();
    for (const id of ['espresso-iced', 'black-coffee-hot', 'black-coffee-iced']) expect(estimateUsage(recipeFor(state, id), state.inventory, null).status).toBe('complete');
    expect(estimateUsage(recipeFor(state, 'hot-tea'), state.inventory, null).gaps).toEqual(['Tea bag: inventory item not confirmed']);
  });

  it('deducts converted amounts from inventory', () => {
    const state = fresh();
    const sale = { id: 's', productId: 'latte-plain-hot', soldAt: '2026-10-28T10:00:00.000Z', usage: estimateUsage(recipeFor(state, 'latte-plain-hot'), state.inventory, 'No topping').usage };
    const balances = inventoryBalances({ ...state, sales: [sale] });
    expect(balances['whole-milk'].estimate).toBeCloseTo(3 - 6.9 / 128, 3);
    expect(balances['hot-cups'].estimate).toBeCloseTo(0.5 - 1 / 25, 3);
    expect(balances['coffee-reg'].estimate).toBeCloseTo(0 - 0.49 / 18, 3);
  });

  it('fills units and counts sweet treat sleeves one by one', () => {
    const state = fresh();
    expect(product(state, 'black-coffee-iced')).toMatchObject({ temperature: 'iced', active: true, recipeKey: 'black-coffee-iced' });
    expect(state.inventory.find((item) => item.id === 'ice')).toMatchObject({ countUnit: 'bag', usageUnit: 'oz', usagePerCount: 320 });
    expect(state.inventory.find((item) => item.id === 'sweet-treat-sleeves')).toMatchObject({ countUnit: 'sleeve', usagePerCount: 1 });
  });

  it('never overwrites what staff already changed, and runs once', () => {
    const edited = cloneInitialState();
    edited.inventory = edited.inventory.map((item) => item.id === 'whole-milk' ? { ...item, countUnit: 'half gallon', usageUnit: 'oz', usagePerCount: 64 } : item);
    edited.recipes = edited.recipes.map((recipe) => recipe.recipeKey === 'rock-chalk-hot' ? { ...recipe, versionId: 'rock-chalk-hot-v2-custom', versionLabel: 'v2' } : recipe);
    const updated = applyAnswersUpdate(applyWorksheetUpdate(edited));
    expect(updated.inventory.find((item) => item.id === 'whole-milk').usagePerCount).toBe(64);
    expect(updated.recipes.filter((recipe) => recipe.recipeKey === 'rock-chalk-hot')).toHaveLength(1);
    expect(applyAnswersUpdate(applyWorksheetUpdate(updated))).toBe(updated);
    expect(updated.settings.appliedUpdates).toEqual([WORKSHEET_UPDATE, ANSWERS_UPDATE]);
  });
});
