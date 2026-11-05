import { SPECIAL_MENU_ID } from './data';
import { currentRecipe, estimateUsage, latteAdditions, withChanges } from './estimates';
import { menuItemFor, productName, specialName } from './ui';
import { uid } from './storage';

// Every sale is built here, whether a student taps a drink button or records an online
// order, so both count against inventory and show in reports the same way.

// One grid position per menu item. Hot and iced variants of a drink share a
// position, and a drink missing in the selected temperature leaves a blank tile,
// so buttons never shift when students switch Hot / Iced.
export function salesSlots(state, temperature) {
  return state.menuItems.filter((entry) => entry.active).sort((a, b) => a.order - b.order).map((menuItem) => {
    const variants = state.products.filter((product) => product.menuItemId === menuItem.id && product.active);
    if (!variants.length) return null;
    return { menuItem, product: variants.find((product) => product.temperature === temperature) || variants.find((product) => product.temperature === 'none') || null };
  }).filter(Boolean);
}

export const isDrink = (state, product) => menuItemFor(state, product)?.kind !== 'food';

// Latte additions (extra syrups and toppings) come from the flavored latte of the same temperature.
export const additionsFor = (state, product) => latteAdditions(currentRecipe(state.recipes, `latte-flavored-${product.temperature === 'iced' ? 'iced' : 'hot'}`));

// Decaf is rare, so it is a one-sale toggle rather than a question on every drink:
// the coffee a decaf drink uses comes out of Coffee Decaf instead of Coffee Reg.
function decafEstimate(estimate, inventory) {
  const decafItem = inventory.find((item) => item.id === 'coffee-decaf');
  if (!decafItem) return estimate;
  return { ...estimate, usage: estimate.usage.map((use) => use.itemId === 'coffee-reg' ? { ...use, itemId: decafItem.id, itemName: decafItem.name } : use) };
}

export function makeSale(state, product, option = null, changes = [], { decaf = false, studentDrink = false, orderId = null, soldAt = new Date().toISOString() } = {}) {
  const recipe = currentRecipe(state.recipes, product.recipeKey);
  const madeDecaf = decaf && isDrink(state, product);
  const free = studentDrink && isDrink(state, product);
  const special = product.menuItemId === SPECIAL_MENU_ID ? specialName(state) : '';
  const baseEstimate = estimateUsage(withChanges(recipe, changes, additionsFor(state, product)), state.inventory, option);
  const estimate = madeDecaf ? decafEstimate(baseEstimate, state.inventory) : baseEstimate;
  return {
    id: uid('sale'), productId: product.id, menuItemId: product.menuItemId, productName: productName(state, product), sourceName: product.sourceName,
    temperature: product.temperature, option, ...(changes.length ? { changes } : {}), ...(special ? { special } : {}), ...(madeDecaf ? { decaf: true } : {}),
    ...(free ? { studentDrink: true } : {}), ...(orderId ? { orderId } : {}), price: free ? 0 : product.price, soldAt,
    recipeVersionId: recipe?.versionId || null, estimateStatus: estimate.status, usage: estimate.usage, gaps: estimate.gaps,
  };
}
