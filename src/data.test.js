import { describe, expect, it } from 'vitest';
import { cloneInitialState, seedInventory, seedMenuItems, seedProducts, seedRecipes } from './data';
import { estimateUsage } from './estimates';

describe('source-backed seed data', () => {
  it('keeps all 16 workbook rows with their exact source names', () => {
    const workbook = seedProducts.filter((product) => !product.sourceName.startsWith('Menu photo'));
    expect(workbook).toHaveLength(16);
    expect(workbook.map((product) => product.sourceName)).toContain('Black Panther Mocha -  ICED');
    expect(workbook.map((product) => product.sourceName)).toContain('Pinckney Pride Cooke. Mocha - ICED');
  });

  it('adds the menu-photo items and supports hot-only and non-temperature products', () => {
    expect(seedProducts.filter((product) => product.temperature === 'hot')).toHaveLength(10);
    expect(seedProducts.filter((product) => product.temperature === 'iced')).toHaveLength(8);
    expect(seedProducts.filter((product) => product.temperature === 'none')).toHaveLength(1);
    expect(seedProducts.filter((product) => product.menuItemId === 'hot-tea').map((product) => product.temperature)).toEqual(['hot']);
    expect(seedProducts.find((product) => product.id === 'bakery-sweet-treat').price).toBe(2.5);
  });

  it('gives every product a menu item, and hot/iced variants share one menu item', () => {
    const ids = new Set(seedMenuItems.map((entry) => entry.id));
    expect(seedProducts.every((product) => ids.has(product.menuItemId))).toBe(true);
    expect(seedProducts.find((product) => product.id === 'espresso-iced').menuItemId).toBe(seedProducts.find((product) => product.id === 'espresso-hot').menuItemId);
  });

  it('loads all ten placeholder cards with ranges preserved and no invented topping amounts', () => {
    expect(seedRecipes).toHaveLength(10);
    const hot = seedRecipes.find((recipe) => recipe.recipeKey === 'rock-chalk-hot');
    expect(hot.lines.find((line) => line.role === 'milk').amount).toEqual({ min: 8, max: 10 });
    expect(seedRecipes.find((recipe) => recipe.recipeKey === 'rock-chalk-iced').lines.find((line) => line.role === 'milk').amount).toEqual({ min: 6, max: 8 });
    expect(seedRecipes.flatMap((recipe) => recipe.lines).filter((line) => line.role === 'topping').every((line) => line.amount === null)).toBe(true);
    expect(seedRecipes.flatMap((recipe) => recipe.lines).every((line) => line.itemConfirmed === false && line.calcAmount === null)).toBe(true);
    expect(seedProducts.filter((product) => product.recipeKey).every((product) => seedRecipes.some((recipe) => recipe.recipeKey === product.recipeKey && recipe.temperature === product.temperature))).toBe(true);
  });

  it('does not produce estimates until staff confirm the setup', () => {
    const state = cloneInitialState();
    expect(seedRecipes.every((recipe) => estimateUsage(recipe, state.inventory).status === 'incomplete')).toBe(true);
  });

  it('loads all 39 populated inventory rows as opening balances', () => {
    expect(seedInventory).toHaveLength(39);
    const state = cloneInitialState();
    expect(state.inventoryEvents.filter((event) => event.type === 'opening')).toHaveLength(39);
  });
});
