import { describe, expect, it } from 'vitest';
import { cloneInitialState } from './data';
import { EXTRA_SHOT, SOY_MILK, changeChoices, currentRecipe, estimateUsage, inventoryBalances, withChanges } from './estimates';
import { migrate } from './storage';
import { ANSWERS_UPDATE, MONTHLY_UPDATE, SPECIAL_BUTTON_UPDATE, VANILLA_UPDATE, WORKSHEET_UPDATE, applyAnswersUpdate, applyWorksheetUpdate } from './updates';

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

describe('monthly special', () => {
  it('has its own hot and iced button using the special syrup', () => {
    const state = fresh();
    expect(state.settings.monthlySpecial).toBe('Pumpkin Spice');
    expect(state.menuItems.find((entry) => entry.id === 'monthly-special')).toMatchObject({ active: true, kind: 'drink' });
    expect(product(state, 'latte-flavored-iced').options).not.toContain('Monthly Special');
    for (const temperature of ['hot', 'iced']) {
      const estimate = estimateUsage(recipeFor(state, `monthly-special-${temperature}`), state.inventory, null);
      expect(estimate.status).toBe('complete');
      expect(used(estimate)).toMatchObject({ 'Monthly Special Syrup': '0.75 oz', 'Whole Milk': '6.9 oz', 'Coffee Reg': '0.49 oz', Whip: '0.352 oz' });
      expect(used(estimate)['Vanilla Syrup']).toBeUndefined();
      expect(used(estimate)['Caramel Drizzle']).toBeUndefined();
    }
    expect(used(estimateUsage(recipeFor(state, 'monthly-special-iced'), state.inventory, null)).Ice).toBe('4 oz');
    expect(inventoryBalances(state)['monthly-special-syrup'].estimate).toBe(0);
  });

  it('moves the special out of the latte on devices that had it as a latte choice', () => {
    const state = fresh();
    const latte = currentRecipe(state.recipes, 'latte-flavored-hot');
    const special = { ...latte, versionId: 'latte-flavored-hot-special-v4', version: latte.version + 1, versionLabel: 'Monthly special (Nov 2026)',
      lines: [...latte.lines, { id: 'flavor-special', role: 'syrup', label: 'Monthly Special Syrup', forOptions: ['Monthly Special'] }] };
    const before = {
      ...state,
      menuItems: state.menuItems.filter((entry) => entry.id !== 'monthly-special'),
      products: state.products.filter((entry) => entry.menuItemId !== 'monthly-special').map((entry) => entry.id === 'latte-flavored-hot' ? { ...entry, options: [...entry.options, 'Monthly Special'] } : entry),
      recipes: [...state.recipes.filter((recipe) => !recipe.recipeKey.startsWith('monthly-special')).map((recipe) => recipe.versionId === latte.versionId ? { ...recipe, supersededAt: '2026-11-02T00:00:00.000Z' } : recipe), special],
      settings: { ...state.settings, appliedUpdates: state.settings.appliedUpdates.filter((name) => name !== SPECIAL_BUTTON_UPDATE) },
    };
    const after = migrate(before);
    expect(product(after, 'latte-flavored-hot').options).not.toContain('Monthly Special');
    expect(currentRecipe(after.recipes, 'latte-flavored-hot').lines.some((entry) => entry.id === 'flavor-special')).toBe(false);
    expect(after.recipes.find((recipe) => recipe.versionId === special.versionId).supersededAt).toBeTruthy();
    expect(product(after, 'monthly-special-hot')).toMatchObject({ recipeKey: 'monthly-special-hot', price: 3.5 });
  });

  it('keeps the staff-chosen flavor name and runs once', () => {
    const state = fresh();
    const renamed = { ...state, settings: { ...state.settings, monthlySpecial: 'Peppermint' } };
    expect(migrate(renamed)).toEqual(renamed);
    expect(renamed.settings.appliedUpdates.slice(-3)).toEqual([MONTHLY_UPDATE, SPECIAL_BUTTON_UPDATE, VANILLA_UPDATE]);
  });
});

describe('plain vanilla latte', () => {
  it('is a flavor choice that uses vanilla syrup and no drizzle', () => {
    const state = fresh();
    expect(product(state, 'latte-flavored-iced').options.slice(0, 3)).toEqual(['Chocolate', 'Vanilla', 'Vanilla + chocolate drizzle']);
    const vanilla = used(estimateUsage(recipeFor(state, 'latte-flavored-hot'), state.inventory, 'Vanilla'));
    expect(vanilla['Vanilla Syrup']).toBe('0.75 oz');
    expect(vanilla['Dark Ch Drizzle']).toBeUndefined();
    expect(vanilla['Caramel Drizzle']).toBeUndefined();
    expect(vanilla.Whip).toBe('0.352 oz');
  });

  it('leaves a recipe staff saved themselves alone', () => {
    const state = fresh();
    const before = { ...state, settings: { ...state.settings, appliedUpdates: state.settings.appliedUpdates.filter((id) => id !== VANILLA_UPDATE) },
      recipes: state.recipes.map((recipe) => recipe.recipeKey === 'latte-flavored-hot' && !recipe.supersededAt ? { ...recipe, savedBy: 'Jen', lines: recipe.lines.map((entry) => entry.itemId === 'vanilla-syrup' ? { ...entry, forOptions: entry.forOptions.filter((option) => option !== 'Vanilla') } : entry) } : recipe) };
    const after = migrate(before);
    expect(recipeFor(after, 'latte-flavored-hot').savedBy).toBe('Jen');
    expect(after.settings.appliedUpdates).toContain(VANILLA_UPDATE);
  });
});

describe('drink changes', () => {
  it('offers toppings to leave off, an extra shot and soy milk', () => {
    const state = fresh();
    expect(changeChoices(recipeFor(state, 'panther-paw-hot'), null, state.inventory)).toEqual(['No whipped cream', 'No caramel drizzle', EXTRA_SHOT, SOY_MILK]);
    expect(changeChoices(recipeFor(state, 'latte-flavored-hot'), 'Caramel', state.inventory)).toContain('No caramel drizzle');
    expect(changeChoices(recipeFor(state, 'latte-plain-hot'), 'Whipped topping', state.inventory, { toppings: false })).toEqual([EXTRA_SHOT, SOY_MILK]);
    expect(changeChoices(recipeFor(state, 'black-coffee-hot'), null, state.inventory)).toEqual([]);
  });

  it('adjusts the inventory estimate', () => {
    const state = fresh();
    const recipe = withChanges(recipeFor(state, 'panther-paw-hot'), ['No whipped cream', EXTRA_SHOT, SOY_MILK]);
    const usage = used(estimateUsage(recipe, state.inventory, null));
    expect(usage.Whip).toBeUndefined();
    expect(usage['Coffee Reg']).toBe('1.47 oz');
    expect(usage['Soy Milk']).toBe('6.9 oz');
    expect(usage['Whole Milk']).toBeUndefined();
  });
});
