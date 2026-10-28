export const SCHEMA_VERSION = 3;
export const RECIPE_SOURCE = 'pinckney_panther_10_hot_and_iced_recipe_cards_5x7.pdf (created 2026-09-29)';
export const SEED_VERSION_LABEL = 'Recipe cards v1';

// Customer-facing menu items. Hot and iced variants of the same drink share one
// grid position so buttons never move when the Hot / Iced selector changes.
const item = (id, name, order, kind = 'drink', reviewNote = '') => ({ id, name, order, kind, active: true, reviewNote });

export const FLAVOR_NOTE = 'Flavor is any syrup listed on the menu, chosen at the register for each sale. Pumps per flavor are not set yet.';

export const seedMenuItems = [
  item('cafe-latte-plain', 'Cafe Latte\nNo Flavor', 1),
  item('cafe-latte-flavored', 'Cafe Latte\nFlavored', 2, 'drink', FLAVOR_NOTE),
  item('rock-chalk', 'Rock Chalk Jayhawk\nMarshmallow Mocha', 3),
  item('panther-paw', 'Panther Paw\nCaramel Latte', 4),
  item('black-panther', 'Black Panther\nMocha', 5),
  item('cinnamon-roll', 'Panther Pride\nCinnamon Roll Latte', 6),
  item('cookie-mocha', 'Pinckney Panther\nCookie Mocha', 7),
  item('espresso', 'Espresso', 8, 'drink', 'Added from the current menu photo; not in the sales workbook.'),
  item('black-coffee', 'Black Coffee', 9, 'drink', 'Workbook name has no temperature; staff confirmed hot only. Menu photo says all drinks are available hot or iced.'),
  item('hot-tea', 'Hot Tea', 10, 'drink', 'Hot only per workbook name. Menu photo says all drinks are available hot or iced.'),
  item('sweet-treat', 'Bakery Sweet Treat', 11, 'food', 'Added from the current menu photo; specific treats are not listed.'),
];

export const LATTE_FLAVORS = ['Chocolate', 'Vanilla', 'Cookie', 'Caramel', 'Cinnamon Sugar', 'Sugar-Free Chocolate', 'Sugar-Free Vanilla'];

// Sale variants. `sourceName` keeps the exact workbook text, including its typos and spacing.
// The owner reviewed the spelling, spacing and capitalization differences and is fine with them.
const variant = (id, menuItemId, temperature, sourceName, recipeKey = null, reviewNote = '', price = 3.5, options = []) => ({ id, menuItemId, temperature, sourceName, recipeKey, reviewNote, price, options, active: true });

export const seedProducts = [
  variant('latte-plain-hot', 'cafe-latte-plain', 'hot', 'Cafe Latte - no flavor HOT'),
  variant('latte-plain-iced', 'cafe-latte-plain', 'iced', 'Cafe Latte - no flavor ICED'),
  variant('latte-flavored-hot', 'cafe-latte-flavored', 'hot', 'Cafe Latte - flavored HOT', null, '', 3.5, LATTE_FLAVORS),
  variant('latte-flavored-iced', 'cafe-latte-flavored', 'iced', 'Cafe Latte - flavored - ICED', null, '', 3.5, LATTE_FLAVORS),
  variant('rock-chalk-hot', 'rock-chalk', 'hot', 'Rock Chalk Marsh Mocha - HOT', 'rock-chalk-hot'),
  variant('rock-chalk-iced', 'rock-chalk', 'iced', 'Rock Chalk Marsh Mocha - ICED', 'rock-chalk-iced'),
  variant('panther-paw-hot', 'panther-paw', 'hot', 'Panther paw Caramel Latte - HOT', 'panther-paw-hot'),
  variant('panther-paw-iced', 'panther-paw', 'iced', 'Panther Paw Caramel Latte - ICED', 'panther-paw-iced'),
  variant('black-panther-hot', 'black-panther', 'hot', 'Black Panther Mocha - HOT', 'black-panther-hot'),
  variant('black-panther-iced', 'black-panther', 'iced', 'Black Panther Mocha -  ICED', 'black-panther-iced'),
  variant('cinnamon-roll-hot', 'cinnamon-roll', 'hot', 'Panther Pride Cinnamon Roll Latte - HOT', 'cinnamon-roll-hot'),
  variant('cinnamon-roll-iced', 'cinnamon-roll', 'iced', 'Panther Pride Cinnamon Rolle Latte - ICED', 'cinnamon-roll-iced'),
  variant('cookie-mocha-hot', 'cookie-mocha', 'hot', 'Pinckney Pride Cookie Mocha - HOT', 'cookie-mocha-hot'),
  variant('cookie-mocha-iced', 'cookie-mocha', 'iced', 'Pinckney Pride Cooke. Mocha - ICED', 'cookie-mocha-iced'),
  variant('espresso-hot', 'espresso', 'hot', 'Menu photo: ESPRESSO'),
  variant('espresso-iced', 'espresso', 'iced', 'Menu photo: ESPRESSO'),
  variant('black-coffee-hot', 'black-coffee', 'hot', 'Black Coffee'),
  variant('hot-tea', 'hot-tea', 'hot', 'Hot Tea'),
  variant('bakery-sweet-treat', 'sweet-treat', 'none', 'Menu photo: BAKERY SWEET TREATS', null, '', 2.5),
];

// Recipe lines keep the card's wording and amounts. `amount: null` means the card
// gives no quantity; nothing is filled in on the card's behalf. Inventory links are
// only suggestions until staff confirm them, and only confirmed links feed estimates.
const line = (id, role, label, amount, unit, suggestedItemId = null, note = '') => ({ id, role, label, amount, unit, calcAmount: null, itemId: suggestedItemId, itemConfirmed: false, ozPerPump: null, excluded: false, note });
const fixed = (value) => ({ min: value, max: value });

const TOPPING_ITEM = { 'Whipped cream': 'whip', 'Caramel drizzle': 'caramel-drizzle', 'Mini marshmallows': 'marshmallows', 'Cinnamon sugar': 'cinnamon' };

const recipe = (key, name, temperature, card, flavors, toppings) => {
  const hot = temperature === 'hot';
  const lines = [
    line('cup', 'cup', hot ? '16 oz paper cup' : '16 oz clear cup', fixed(1), 'each', hot ? 'hot-cups' : 'cold-cups'),
    line('lid', 'consumable', hot ? 'Hot cup lid' : 'Cold cup lid', null, 'each', null, 'Not on the recipe card or inventory sheet. Confirm use and add an inventory item.'),
    hot
      ? line('sleeve', 'consumable', 'Hot cup sleeve', null, 'each', 'hot-sleeves', 'Not on the recipe card. Confirm whether every hot drink gets a sleeve.')
      : line('straw', 'consumable', 'Straw', null, 'each', null, 'Not on the recipe card or inventory sheet. Confirm use and add an inventory item.'),
    line('espresso', 'espresso', 'Espresso', fixed(2), 'shot', 'coffee-reg', 'Confirm that "Coffee Reg" is the espresso bean and how many shots one bag makes.'),
    ...flavors.map(([label, pumps, itemId], index) => line(`flavor-${index + 1}`, 'syrup', label, fixed(pumps), 'pump', itemId)),
    hot
      ? line('milk', 'milk', 'Steamed milk', { min: 8, max: 10 }, 'oz', 'whole-milk', 'Card does not name the milk type.')
      : line('milk', 'milk', 'Cold milk', { min: 6, max: 8 }, 'oz', 'whole-milk', 'Card does not name the milk type.'),
    ...(hot ? [] : [line('ice', 'ice', 'Ice (fill the rest of the cup)', null, null, 'ice', 'Card gives no measured amount.')]),
    ...toppings.map((label, index) => line(`topping-${index + 1}`, 'topping', label, null, null, TOPPING_ITEM[label] || null, 'Card gives no quantity.')),
  ];
  return {
    versionId: `${key}-placeholder-v1`, // ID kept stable so earlier sales still point at it
    recipeKey: key,
    version: 1,
    versionLabel: SEED_VERSION_LABEL,
    effectiveFrom: '2026-09-29T00:00:00.000Z',
    supersededAt: null,
    name,
    temperature,
    cupSize: '16 oz',
    cupType: hot ? 'Paper cup' : 'Clear cup',
    espressoShots: 2,
    lines,
    instructions: hot
      ? '1. Add flavors. 2. Pull 2 shots, add to cup, stir. 3. Pour 8-10 oz steamed milk. 4. Finish with toppings.'
      : '1. Add flavors. 2. Pull 2 shots, add to cup, stir. 3. Pour 6-8 oz cold milk; fill the rest of the cup with ice. 4. Finish with toppings.',
    sourceCard: `Card ${card}/10`,
    sourceDocument: RECIPE_SOURCE,
    changeNote: 'Imported from the Pinckney Panther recipe cards. Card pump guide: 1 pump = 1/4 oz, to be confirmed for each dispenser.',
  };
};

const ROCK = [['Chocolate sauce', 4, 'chocolate-syrup'], ['Toasted marshmallow', 3, 'toasted-marshmallow']];
const PAW = [['Caramel syrup', 3, 'classic-caramel'], ['Vanilla syrup', 1, 'vanilla-syrup']];
const BLACK = [['Dark chocolate sauce', 4, null], ['Vanilla syrup', 1, 'vanilla-syrup']];
const ROLL = [['Brown sugar cinnamon', 3, 'brown-sugar'], ['Vanilla syrup', 1, 'vanilla-syrup']];
const COOKIE = [['Chocolate sauce', 3, 'chocolate-syrup'], ['Cookie butter syrup', 3, 'cookie-butter']];

export const seedRecipes = [
  recipe('rock-chalk-hot', 'Rock Chalk Jayhawk Marshmallow Mocha', 'hot', 1, ROCK, ['Whipped cream', 'Chocolate drizzle', 'Mini marshmallows']),
  recipe('panther-paw-hot', 'Panther Paw Caramel Latte', 'hot', 2, PAW, ['Whipped cream', 'Caramel drizzle']),
  recipe('black-panther-hot', 'Black Panther Mocha', 'hot', 3, BLACK, ['Whipped cream', 'Chocolate drizzle']),
  recipe('cinnamon-roll-hot', 'Panther Pride Cinnamon Roll Latte', 'hot', 4, ROLL, ['Whipped cream', 'Cinnamon sugar']),
  recipe('cookie-mocha-hot', 'Pinckney Panther Cookie Mocha', 'hot', 5, COOKIE, ['Whipped cream', 'Cookie crumbs']),
  recipe('rock-chalk-iced', 'Rock Chalk Jayhawk Marshmallow Mocha', 'iced', 6, ROCK, ['Whipped cream', 'Chocolate drizzle', 'Mini marshmallows']),
  recipe('panther-paw-iced', 'Panther Paw Caramel Latte', 'iced', 7, PAW, ['Whipped cream', 'Caramel drizzle']),
  recipe('black-panther-iced', 'Black Panther Mocha', 'iced', 8, BLACK, ['Whipped cream', 'Chocolate drizzle']),
  recipe('cinnamon-roll-iced', 'Panther Pride Cinnamon Roll Latte', 'iced', 9, ROLL, ['Whipped cream', 'Cinnamon sugar']),
  recipe('cookie-mocha-iced', 'Pinckney Panther Cookie Mocha', 'iced', 10, COOKIE, ['Whipped cream', 'Cookie crumbs']),
];

export const INVENTORY_CATEGORIES = ['Coffee & bar', 'Milk & cream', 'Syrups & sauces', 'Toppings & sweeteners', 'Cups & to-go', 'Supplies'];

// `onHand` is the workbook value and becomes the opening balance. Units are blank
// because the workbook does not define them; staff fill them in.
const inv = (id, name, category, full, onHand, need, note = '') => ({ id, name, sourceName: name, category, full, onHand, need, countUnit: '', usageUnit: '', usagePerCount: null, ozPerPump: null, active: true, note });
const SYRUP_NOTE = 'Cards say 1 pump = 1/4 oz. Measure this dispenser before entering ounces per pump.';

export const seedInventory = [
  inv('coffee-reg', 'Coffee Reg', 'Coffee & bar', 6, 0, 6),
  inv('coffee-decaf', 'Coffee Decaf', 'Coffee & bar', 1, 0, 1),
  inv('hot-coco', 'Hot Coco Mix', 'Coffee & bar', 1, 1, 0),
  inv('ice', 'Ice', 'Coffee & bar', 2, 2, 0),
  inv('whole-milk', 'Whole Milk', 'Milk & cream', 3, 3, 0),
  inv('soy-milk', 'Soy Milk', 'Milk & cream', 1, 0.5, 0, 'Workbook shows 1/2, but the cell is date-formatted (reads as Jan 2, 2026). Recount.'),
  inv('whip', 'Whip', 'Milk & cream', 4, 3, 1),
  inv('creamers', 'Creamers ', 'Milk & cream', 1, 1, 0),
  inv('chocolate-syrup', 'Chocolate syrup', 'Syrups & sauces', 4, 2, 2, SYRUP_NOTE),
  inv('sf-chocolate', 'SF Chocolate Syrup', 'Syrups & sauces', 2, 2, 0, SYRUP_NOTE),
  inv('vanilla-syrup', 'Vanilla Syrup', 'Syrups & sauces', 4, 2, 2, SYRUP_NOTE),
  inv('sf-vanilla', 'SF Vanilla Syrup', 'Syrups & sauces', 2, 1, 1, SYRUP_NOTE),
  inv('cookie-butter', 'Cookie Butter Syrup', 'Syrups & sauces', 3, 3, 0, SYRUP_NOTE),
  inv('brown-sugar', 'Brn Sugar Cinnamon Syrup', 'Syrups & sauces', 3, 3, 0, SYRUP_NOTE),
  inv('toasted-marshmallow', 'Toasted Marshmallow Syrup', 'Syrups & sauces', 3, 2, 1, SYRUP_NOTE),
  inv('classic-caramel', 'Classic Caramel Syrup', 'Syrups & sauces', 3, 3, 0, SYRUP_NOTE),
  inv('caramel-drizzle', 'Caramel Drizzle', 'Toppings & sweeteners', 2, 1, 1),
  inv('dark-ch-drizzle', 'Dark Ch Drizzle', 'Toppings & sweeteners', 2, 1, 1),
  inv('lornadoones', 'Lornadoones', 'Toppings & sweeteners', 2, 2, 0, 'Name needs staff review; may be the cookie-crumb topping.'),
  inv('marshmallows', 'Marshmallows', 'Toppings & sweeteners', 2, 1, 1),
  inv('cinnamon', 'Cinnamon', 'Toppings & sweeteners', 1, 0.5, 0),
  inv('sugar-loose', 'Sugar Loose', 'Toppings & sweeteners', 1, 1, 0),
  inv('sugar-packets', 'Sugar Packets', 'Toppings & sweeteners', 2, 2, 0),
  inv('hot-cups', 'Hot cups', 'Cups & to-go', 1, 0.5, 1),
  inv('cold-cups', 'Cold cups', 'Cups & to-go', 1, 0.5, 1),
  inv('hot-sleeves', 'Hot Cup Sleeves', 'Cups & to-go', 1, 1, 0),
  inv('stir-sticks', 'Stir Sticks', 'Cups & to-go', 1, 1, 0),
  inv('napkins', 'Napkins', 'Cups & to-go', 1, 1, 0),
  inv('two-cup-holders', '2 Cup Holders', 'Cups & to-go', 3, 3, 0),
  inv('four-cup-holders', '4 Cup Holders', 'Cups & to-go', 1, 1, 0),
  inv('sweet-treat-sleeves', 'Sweet Treat Sleeves', 'Cups & to-go', 200, 100, 100),
  inv('paper-towel-dispenser', 'Paper Towels (Dispenser)', 'Supplies', 1, 1, 0),
  inv('paper-towel-roll', 'Paper Towels (Roll)', 'Supplies', 12, 11, 0),
  inv('gloves', 'Gloves', 'Supplies', 2, 1, 1),
  inv('stickers-large', 'Emp Brew Stickers (large)', 'Supplies', 1, 1, 0),
  inv('stickers-small', 'Emp Brew Stickers (Small)', 'Supplies', 1, 0, 1),
  inv('avery-5219', 'Avery 5219', 'Supplies', 1, 1, 0),
  inv('label-tape', 'Label Maker Tape (1/2in LT)', 'Supplies', 1, 1, 0),
  inv('hand-soap', 'Hand Soap', 'Supplies', 1, 1, 0),
];

export function cloneInitialState(now = new Date().toISOString()) {
  const inventory = JSON.parse(JSON.stringify(seedInventory));
  return {
    schemaVersion: SCHEMA_VERSION,
    menuItems: JSON.parse(JSON.stringify(seedMenuItems)),
    products: JSON.parse(JSON.stringify(seedProducts)),
    recipes: JSON.parse(JSON.stringify(seedRecipes)),
    inventory,
    // Every balance is derived from this ledger, starting at the workbook's On Hand values.
    inventoryEvents: inventory.map((entry) => ({ id: `opening-${entry.id}`, type: 'opening', itemId: entry.id, itemName: entry.name, countedValue: entry.onHand, at: now, by: 'Coffee Shop Inventory workbook', note: 'Opening balance from the On Hand column' })),
    sales: [],
    countSessions: [],
    settings: { studentCounts: true, backupTime: '15:00', lastSalesBackupAt: null },
    staffPinHash: null,
  };
}
