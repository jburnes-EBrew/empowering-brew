import { SHOP_HOURS, SPECIAL_MENU_ID, optionLabel } from './data';
import { changeChoices, currentRecipe } from './estimates';
import { additionsFor, isDrink } from './sales';
import { oneLine, productLabel, specialName } from './ui';

// Online orders: staff order from the Apps Script order page, orders wait in a Google
// Sheet, and this iPad checks the sheet through the "iPad link" (a second deployment of
// the same script, protected by a secret key). Orders live only in the sheet until a
// student records one as a sale, so nothing here touches saved data on its own.

export const POLL_SECONDS = 15;
export const ACTIVE_STATUSES = ['new', 'making', 'ready'];
export const STATUS_LABELS = { new: 'New', making: 'Making', ready: 'Ready for pickup', 'picked-up': 'Picked up', 'not-picked-up': 'Not picked up', declined: 'Could not make', cancelled: 'Cancelled by teacher' };

export const orderSettings = (state) => state.settings?.onlineOrders || {};
export const linkReady = (settings) => !!(settings.enabled && settings.url?.trim() && settings.key?.trim());

// The flavor choices and the Take off / Add or swap choices, exactly as the drink box
// on the sales screen offers them, so an online order can always be recorded as is.
function choicesFor(state, product, option) {
  if (!isDrink(state, product)) return { remove: [], add: [] };
  const toppings = !product.options?.includes('No topping'); // plain lattes choose toppings as their option
  return changeChoices(currentRecipe(state.recipes, product.recipeKey), option, state.inventory, { toppings, additions: additionsFor(state, product) });
}

// What the order page offers. Sent to the sheet whenever it changes, so a new monthly
// special or a drink turned off on this iPad shows up there within a few seconds.
export function orderingMenu(state) {
  const special = specialName(state);
  const items = state.menuItems.filter((entry) => entry.active).sort((a, b) => a.order - b.order).map((menuItem) => {
    const variants = state.products.filter((product) => product.menuItemId === menuItem.id && product.active);
    if (!variants.length) return null;
    const isSpecial = menuItem.id === SPECIAL_MENU_ID;
    return {
      id: menuItem.id,
      name: isSpecial ? special || 'Monthly Special' : oneLine(menuItem.name),
      kind: menuItem.kind === 'food' ? 'food' : 'drink',
      special: isSpecial,
      variants: variants.map((product) => {
        const options = product.options || [];
        const keys = options.length ? options : [''];
        return {
          id: product.id,
          temperature: product.temperature,
          price: product.price,
          label: productLabel(state, product),
          options: options.map((value) => ({ value, label: optionLabel(value, special) })),
          choices: Object.fromEntries(keys.map((key) => [key, choicesFor(state, product, key || null)])),
        };
      }),
    };
  }).filter(Boolean);
  return { items, hours: SHOP_HOURS };
}

// Turns an online order back into what the sales screen records. Anything that changed on
// this iPad since the order was placed (a drink turned off, a flavor removed) is reported
// so the student can record the drink with the buttons instead.
export function orderSaleParts(state, order) {
  const product = state.products.find((entry) => entry.id === order.productId);
  if (!product || !product.active) return { problem: 'This drink is no longer on the menu on this iPad.' };
  const options = product.options || [];
  if (options.length && !options.includes(order.option)) return { problem: 'That flavor is no longer offered on this iPad.' };
  const option = options.length ? order.option : null;
  const { remove, add } = choicesFor(state, product, option);
  const changes = (order.changes || []).filter((change) => remove.includes(change) || add.includes(change));
  const dropped = (order.changes || []).filter((change) => !changes.includes(change));
  return { product, option, changes, dropped, decaf: !!order.decaf && isDrink(state, product) };
}

export const orderDetails = (order) => [order.optionLabel || order.option, ...(order.changes || []), order.decaf && 'Decaf'].filter(Boolean);

// Sales recorded from an order carry its ID; an undone sale no longer counts.
export const saleForOrder = (sales, orderId) => sales.find((sale) => sale.orderId === orderId && !sale.voidedAt) || null;

// Pickup order first; orders with the same pickup time keep the order they came in.
export const sortOrders = (orders) => [...orders].sort((a, b) => a.pickupAt.localeCompare(b.pickupAt) || a.placedAt.localeCompare(b.placedAt));

// Checks for orders only around shop hours (15 minutes before opening to 30 minutes after
// closing, for late pickups). Outside that the order page shows the shop as closed.
export function inOrderWindow(now = new Date(), hours = SHOP_HOURS) {
  const day = (now.getDay() + 6) % 7;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return hours.days.includes(day) && minutes >= hours.openMinutes - 15 && minutes < hours.closeMinutes + 30;
}

export const minutesUntil = (iso, now = new Date()) => Math.round((Date.parse(iso) - now.getTime()) / 60000);

// One call to the iPad link. The body is sent as plain text so the browser can call
// Apps Script directly from this site (a JSON content type would be blocked).
export async function callLink(settings, action, data = {}, fetcher = globalThis.fetch) {
  let response;
  try {
    response = await fetcher(settings.url.trim(), { method: 'POST', body: JSON.stringify({ ...data, key: settings.key.trim(), action }), redirect: 'follow' });
  } catch {
    throw new Error('Could not reach the order sheet. Check the internet connection, and that the iPad link is deployed with access set to Anyone.');
  }
  if (!response.ok) throw new Error(`The order sheet did not answer (error ${response.status}).`);
  let result;
  try { result = await response.json(); } catch {
    throw new Error('The iPad link answered with a web page instead of orders. Check that you copied the iPad link (not the staff order page) and that it is deployed with access set to Anyone.');
  }
  if (!result?.ok) throw new Error(result?.error || 'The order sheet could not do that.');
  return result;
}
