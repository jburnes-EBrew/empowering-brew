import { FLAVOR_NOTE, MONTHLY_SPECIAL, SPECIAL_MENU_ID, SYRUP_NOTE_V1, fixed, line, seedProducts } from './data';

// Owner-supplied data that arrives after the first import. Each update runs once per
// device (tracked in settings.appliedUpdates) and never overwrites anything staff have
// already changed on that device: edited recipes, filled-in units and renamed notes stay.

export const WORKSHEET_UPDATE = 'worksheets-2026-10-28';
const WORKSHEET_SOURCE = 'Empowering Brew setup worksheets (Oct 2026)';
const WORKSHEET_LABEL = 'Setup worksheet (Oct 2026)';

// Flavored latte choices: the menu's syrups. The Latte flavors tab sets the drizzle for
// each flavor; Vanilla and Sugar-Free Vanilla let the student choose it.
export const FLAVORED_LATTE_OPTIONS = [
  'Chocolate', 'Vanilla + chocolate drizzle', 'Vanilla + caramel drizzle', 'Cookie', 'Caramel', 'Cinnamon Sugar',
  'Sugar-Free Chocolate', 'Sugar-Free Vanilla + chocolate drizzle', 'Sugar-Free Vanilla + caramel drizzle',
];
// Plain lattes: whipped topping and drizzle are optional.
export const PLAIN_LATTE_OPTIONS = ['No topping', 'Whipped topping', 'Whip + chocolate drizzle', 'Whip + caramel drizzle'];
const OLD_LATTE_FLAVORS = ['Chocolate', 'Vanilla', 'Cookie', 'Caramel', 'Cinnamon Sugar', 'Sugar-Free Chocolate', 'Sugar-Free Vanilla'];

const withChocolateDrizzle = (options) => options.filter((option) => /chocolate drizzle/.test(option) || option === 'Chocolate' || option === 'Sugar-Free Chocolate');
const withCaramelDrizzle = (options) => options.filter((option) => /caramel drizzle/.test(option) || option === 'Cookie' || option === 'Caramel');

const confirmed = (entry, patch = {}) => ({ ...entry, itemConfirmed: true, note: '', ...patch });
const forOptions = (entry, options) => ({ ...entry, forOptions: options });
const CHOCOLATE_DRIZZLE_NOTE = 'Worksheet left the inventory item blank. Dark Ch Drizzle is a suggestion; confirm it.';
const COOKIE_CRUMB_NOTE = 'Worksheet left the inventory item blank. Lornadoones is a suggestion; confirm it.';
const LID_NOTE = 'No lid item on the inventory list yet.';

// Signature drinks: the setup worksheet's Recipe amounts tab. Pumps match the cards.
function signatureLine(entry, temperature) {
  switch (entry.id) {
    case 'cup': case 'espresso': return confirmed(entry);
    case 'sleeve': return confirmed(entry, { amount: fixed(1) });
    case 'milk': return confirmed(entry, { calcAmount: 6.9 });
    case 'ice': return confirmed(entry, { amount: fixed(2), unit: 'oz' });
    default: break;
  }
  if (entry.role === 'syrup') return entry.itemId ? confirmed(entry) : entry;
  if (entry.role !== 'topping') return entry;
  switch (entry.label) {
    case 'Whipped cream': return confirmed(entry, { amount: fixed(4), unit: 'Tbs' });
    case 'Caramel drizzle': return confirmed(entry, { amount: fixed(2), unit: 'Tbs' });
    case 'Cinnamon sugar': return confirmed(entry, { amount: fixed(0.1), unit: 'oz' });
    case 'Mini marshmallows': return confirmed(entry, temperature === 'hot' ? { amount: fixed(2), unit: 'oz' } : { amount: fixed(2), unit: 'Tbs' });
    case 'Chocolate drizzle': return { ...entry, amount: fixed(2), unit: 'Tbs', itemId: 'dark-ch-drizzle', itemConfirmed: false, note: CHOCOLATE_DRIZZLE_NOTE };
    case 'Cookie crumbs': return { ...entry, amount: fixed(2), unit: 'Tbs', itemId: 'lornadoones', itemConfirmed: false, note: COOKIE_CRUMB_NOTE };
    default: return entry;
  }
}

const recipeVersion = (base, fields) => ({
  cupSize: '', cupType: '', espressoShots: null, instructions: '', sourceCard: '', ...base, ...fields,
  versionLabel: WORKSHEET_LABEL, sourceDocument: WORKSHEET_SOURCE, supersededAt: null,
});

// Lines shared by every hot or iced drink in the lattes, espresso, coffee and tea worksheet.
const cup = (hot) => confirmed(line('cup', 'cup', hot ? 'Hot cup' : 'Cold cup', fixed(1), 'each', hot ? 'hot-cups' : 'cold-cups'));
const lid = () => line('lid', 'consumable', 'Lid', fixed(1), 'each', null, LID_NOTE);
const sleeve = () => confirmed(line('sleeve', 'consumable', 'Hot cup sleeve', fixed(1), 'each', 'hot-sleeves'));
const shot = (count) => confirmed(line('espresso', 'espresso', 'Espresso', fixed(count), 'shot', 'coffee-reg'));

function latteLines(hot, options, { whipAlways }) {
  const chocolate = withChocolateDrizzle(options);
  const caramel = withCaramelDrizzle(options);
  const whip = confirmed(line('whip', 'topping', 'Whipped topping', fixed(4), 'Tbs', 'whip'));
  return [
    cup(hot), lid(),
    hot ? sleeve() : { ...line('straw', 'consumable', 'Straw', fixed(0), 'each'), excluded: true, note: 'Worksheet: 0 straws.' },
    shot(1),
    confirmed(line('milk', 'milk', hot ? 'Steamed milk' : 'Cold milk', fixed(6.9), 'oz', 'whole-milk')),
    ...(hot ? [] : [confirmed(line('ice', 'ice', 'Ice', fixed(4), 'oz', 'ice'))]),
    whipAlways ? whip : forOptions(whip, options.filter((option) => option !== 'No topping')),
    forOptions({ ...line('drizzle-chocolate', 'topping', 'Chocolate drizzle', fixed(2), 'Tbs', 'dark-ch-drizzle'), note: CHOCOLATE_DRIZZLE_NOTE }, chocolate),
    forOptions(confirmed(line('drizzle-caramel', 'topping', 'Caramel drizzle', fixed(2), 'Tbs', 'caramel-drizzle')), caramel),
  ];
}

// Latte flavors tab: 3 pumps hot and iced for every flavor.
const FLAVOR_SYRUPS = [
  ['Chocolate syrup', 'chocolate-syrup', ['Chocolate']],
  ['Vanilla Syrup', 'vanilla-syrup', ['Vanilla + chocolate drizzle', 'Vanilla + caramel drizzle']],
  ['Cookie Butter Syrup', 'cookie-butter', ['Cookie']],
  ['Classic Caramel Syrup', 'classic-caramel', ['Caramel']],
  ['Brn Sugar Cinnamon Syrup', 'brown-sugar', ['Cinnamon Sugar'], 'Worksheet asked whether Cinnamon Sugar is this syrup; not confirmed yet.'],
  ['SF Chocolate Syrup', 'sf-chocolate', ['Sugar-Free Chocolate']],
  ['SF Vanilla Syrup', 'sf-vanilla', ['Sugar-Free Vanilla + chocolate drizzle', 'Sugar-Free Vanilla + caramel drizzle']],
];
const flavorSyrupLines = () => FLAVOR_SYRUPS.map(([label, itemId, options, unconfirmedNote], index) => {
  const entry = line(`flavor-${index + 1}`, 'syrup', label, fixed(3), 'pump', itemId);
  return forOptions(unconfirmedNote ? { ...entry, note: unconfirmedNote } : confirmed(entry), options);
});

function newRecipes(now) {
  const base = { version: 1, effectiveFrom: now, changeNote: 'From the lattes, espresso, coffee and tea worksheet.' };
  const latte = (key, name, hot, extra) => recipeVersion(base, { versionId: `${key}-worksheet-v1`, recipeKey: key, name, temperature: hot ? 'hot' : 'iced', cupType: hot ? 'Hot cup' : 'Cold cup', espressoShots: 1, ...extra });
  return [
    latte('latte-plain-hot', 'Cafe Latte No Flavor', true, { lines: latteLines(true, PLAIN_LATTE_OPTIONS, { whipAlways: false }) }),
    latte('latte-plain-iced', 'Cafe Latte No Flavor', false, { lines: latteLines(false, PLAIN_LATTE_OPTIONS, { whipAlways: false }) }),
    latte('latte-flavored-hot', 'Cafe Latte Flavored', true, { lines: [...latteLines(true, FLAVORED_LATTE_OPTIONS, { whipAlways: true }), ...flavorSyrupLines()] }),
    latte('latte-flavored-iced', 'Cafe Latte Flavored', false, { lines: [...latteLines(false, FLAVORED_LATTE_OPTIONS, { whipAlways: true }), ...flavorSyrupLines()] }),
    latte('espresso-hot', 'Espresso', true, { cupType: '', lines: [{ ...cup(true), itemConfirmed: false, note: 'Worksheet did not say which cup; Hot cups is a suggestion.' }, lid(), shot(1)] }),
    recipeVersion(base, { versionId: 'black-coffee-hot-worksheet-v1', recipeKey: 'black-coffee-hot', name: 'Black Coffee', temperature: 'hot', cupType: 'Hot cup', lines: [
      cup(true), lid(), sleeve(),
      line('coffee', 'other', 'Brewed coffee', fixed(10), 'oz', null, '10 oz of brewed coffee. To count it against Coffee Reg, the app needs the ground coffee used per cup or per pot.'),
    ] }),
    recipeVersion(base, { versionId: 'hot-tea-worksheet-v1', recipeKey: 'hot-tea', name: 'Hot Tea', temperature: 'hot', cupType: 'Hot cup', lines: [
      cup(true), lid(), sleeve(),
      line('tea-bag', 'other', 'Tea bag', fixed(1), 'each', null, 'Tea bags are not on the inventory list yet.'),
    ] }),
  ];
}

// Units & sizes tab: [countUnit, onePackageHolds, usageUnit, ozPerPump]. Blank answers are left out.
const UNITS = {
  'coffee-reg': ['bag', 18, 'oz'], 'coffee-decaf': ['bag', 18, 'oz'], 'hot-coco': ['canister', 38.27, 'oz'],
  ice: ['bag', 320, 'oz'], // 20 lb bag = 320 oz
  'whole-milk': ['gallon', 128, 'oz'], 'soy-milk': ['half gallon', 64, 'oz'], whip: ['can', 10, 'oz'], creamers: ['box', null, 'oz'],
  'caramel-drizzle': ['bottle', 16.5, 'oz'], 'dark-ch-drizzle': ['bottle', 16.5, 'oz'], lornadoones: ['box', 10, 'oz'], marshmallows: ['bag', 10, 'oz'],
  cinnamon: ['jar', 1.62, 'oz'], 'sugar-loose': ['bag', 32, 'oz'], 'sugar-packets': ['packets', 12.35, 'oz'],
  'hot-cups': ['sleeve', 25, 'each'], 'cold-cups': ['sleeve', 50, 'each'], 'hot-sleeves': ['bundle', 50, 'each'], 'stir-sticks': ['box', 1000, 'each'],
  napkins: ['bundle', 100, 'each'], 'two-cup-holders': ['bundle', 25, 'each'], 'four-cup-holders': ['box', 45, 'each'], 'sweet-treat-sleeves': ['bundle', 50, 'each'],
  'paper-towel-dispenser': ['bundle', 100, 'each'], 'paper-towel-roll': ['roll', 12, 'each'], gloves: ['box', 500, 'each'],
  'stickers-large': ['', 500, 'each'], 'stickers-small': ['', null, 'each'], 'avery-5219': ['pack', 60, 'each'], 'label-tape': ['pack', 1, 'each'], 'hand-soap': ['bottle', 50, 'oz'],
};
for (const id of ['chocolate-syrup', 'sf-chocolate', 'vanilla-syrup', 'sf-vanilla', 'cookie-butter', 'brown-sugar', 'toasted-marshmallow', 'classic-caramel']) UNITS[id] = ['bottle', 24.5, 'oz', 0.25];
const SYRUP_NOTE_V2 = '0.25 oz per pump from the setup worksheet (Oct 2026). Change it if this dispenser measures differently.';

function fillUnits(item) {
  const answer = UNITS[item.id];
  if (!answer) return item;
  const [countUnit, holds, usageUnit, ozPerPump] = answer;
  const next = { ...item };
  // Only fill blanks; anything already entered on this device wins.
  if (!next.countUnit && countUnit) next.countUnit = countUnit;
  if (!next.usageUnit) next.usageUnit = usageUnit;
  if (next.usagePerCount == null && holds != null && next.usageUnit === usageUnit) next.usagePerCount = holds;
  if (next.ozPerPump == null && ozPerPump != null) next.ozPerPump = ozPerPump;
  if (next.ozPerShot === undefined) next.ozPerShot = null;
  if (next.note === SYRUP_NOTE_V1 && next.ozPerPump === ozPerPump) next.note = SYRUP_NOTE_V2;
  return next;
}

const NOTE_UPDATES = {
  'black-coffee': ['Workbook name has no temperature; staff confirmed hot only. Menu photo says all drinks are available hot or iced.', 'Hot and iced (worksheet, Oct 2026). The iced recipe is not set yet.'],
  'hot-tea': ['Hot only per workbook name. Menu photo says all drinks are available hot or iced.', ''],
  'cafe-latte-flavored': [FLAVOR_NOTE, ''],
};

export function applyWorksheetUpdate(state, now = new Date().toISOString()) {
  if (state.settings?.appliedUpdates?.includes(WORKSHEET_UPDATE)) return state;

  // Signature drinks: a new version only where this device still has the card version.
  const supersede = new Set();
  const added = [];
  for (const recipe of state.recipes) {
    if (recipe.supersededAt || recipe.versionId !== `${recipe.recipeKey}-placeholder-v1`) continue;
    supersede.add(recipe.versionId);
    added.push({
      ...recipe, versionId: `${recipe.recipeKey}-worksheet-v2`, version: recipe.version + 1, versionLabel: WORKSHEET_LABEL, effectiveFrom: now, supersededAt: null,
      lines: recipe.lines.map((entry) => signatureLine(entry, recipe.temperature)),
      changeNote: 'Amounts and inventory items from the setup worksheet. Pumps unchanged from the cards.',
    });
  }
  const existingKeys = new Set(state.recipes.map((recipe) => recipe.recipeKey));
  added.push(...newRecipes(now).filter((recipe) => !existingKeys.has(recipe.recipeKey)));
  const recipeKeys = new Set([...existingKeys, ...added.map((recipe) => recipe.recipeKey)]);

  const seedById = Object.fromEntries(seedProducts.map((product) => [product.id, product]));
  const RECIPE_FOR = { 'latte-plain-hot': 'latte-plain-hot', 'latte-plain-iced': 'latte-plain-iced', 'latte-flavored-hot': 'latte-flavored-hot', 'latte-flavored-iced': 'latte-flavored-iced', 'espresso-hot': 'espresso-hot', 'black-coffee-hot': 'black-coffee-hot', 'hot-tea': 'hot-tea' };
  const products = state.products.map((product) => {
    const next = { ...product };
    if (!next.recipeKey && RECIPE_FOR[next.id] && recipeKeys.has(RECIPE_FOR[next.id])) next.recipeKey = RECIPE_FOR[next.id];
    const unchanged = JSON.stringify(next.options) === JSON.stringify(OLD_LATTE_FLAVORS) || JSON.stringify(next.options) === JSON.stringify(seedById[next.id]?.options);
    if (next.menuItemId === 'cafe-latte-flavored' && unchanged) next.options = FLAVORED_LATTE_OPTIONS;
    if (next.menuItemId === 'cafe-latte-plain' && !next.options?.length) next.options = PLAIN_LATTE_OPTIONS;
    return next;
  });
  // Iced Black Coffee: the worksheet says Black Coffee also comes iced.
  if (!products.some((product) => product.menuItemId === 'black-coffee' && product.temperature === 'iced') && state.menuItems.some((entry) => entry.id === 'black-coffee')) {
    products.push({ id: 'black-coffee-iced', menuItemId: 'black-coffee', temperature: 'iced', sourceName: 'Worksheet answer: Black Coffee also iced', recipeKey: null, reviewNote: '', price: products.find((product) => product.id === 'black-coffee-hot')?.price ?? 3.5, options: [], active: true });
  }

  const menuItems = state.menuItems.map((entry) => {
    const update = NOTE_UPDATES[entry.id];
    return update && entry.reviewNote === update[0] ? { ...entry, reviewNote: update[1] } : entry;
  });

  return {
    ...state,
    menuItems,
    products,
    recipes: [...state.recipes.map((recipe) => supersede.has(recipe.versionId) ? { ...recipe, supersededAt: now } : recipe), ...added],
    inventory: state.inventory.map(fillUnits),
    settings: { ...state.settings, appliedUpdates: [...(state.settings?.appliedUpdates || []), WORKSHEET_UPDATE] },
  };
}


// Owner answers to the worksheet follow-up questions (Oct 29, 2026). Industry-standard
// estimates are used where the owner asked for them; each says so in its note.
export const ANSWERS_UPDATE = 'answers-2026-10-29';
const ANSWERS_LABEL = 'Owner answers (Oct 2026)';
const LIDS_NOTE = 'Lids come with the cups, so they are counted with the cups.';
const STANDARD = 'Industry-standard estimate; replace it with a measured number when you have one.';

// Espresso machine (KitchenAid KES8558): one shot is 2 oz of brewed espresso. The
// machine's dose is not published; 14 g of grounds for 2 oz is the usual double-shot dose.
const OZ_GROUNDS_PER_SHOT = 0.49; // 14 g
// Machine-brewed black coffee is 6.9 oz; about 12 g of grounds (a 1:17 brew ratio).
const OZ_GROUNDS_PER_COFFEE = 0.42;
// Ounces (by weight) per level tablespoon, from typical package labels:
// aerosol whipped cream 2 Tbs = 5 g; chocolate and caramel sauce 2 Tbs = 39 g;
// shortbread cookie crumbs 1 Tbs = 6 g.
const OZ_PER_TBS = { whip: 0.088, 'caramel-drizzle': 0.69, 'dark-ch-drizzle': 0.69, lornadoones: 0.22 };

const groundsLine = () => ({ ...confirmed(line('coffee', 'espresso', 'Ground coffee (machine-brewed 6.9 oz)', fixed(OZ_GROUNDS_PER_COFFEE), 'oz', 'coffee-reg')), note: `About 12 g of grounds per 6.9 oz cup. ${STANDARD}` });

function answerLine(entry, recipe) {
  if (entry.id === 'lid') return { ...entry, amount: fixed(1), unit: 'each', itemId: null, itemConfirmed: false, excluded: true, note: LIDS_NOTE };
  if (entry.id === 'straw') return { ...entry, amount: fixed(0), excluded: true, note: 'No straws are used.' };
  if (entry.role === 'milk' && entry.amount && entry.amount.min !== entry.amount.max) return { ...entry, amount: fixed(entry.calcAmount ?? entry.amount.min), calcAmount: null };
  if (entry.label === 'Mini marshmallows') return { ...entry, amount: fixed(2), unit: 'oz' };
  if (entry.itemId === 'dark-ch-drizzle' || entry.itemId === 'lornadoones' || entry.itemId === 'brown-sugar') return { ...entry, itemConfirmed: true, note: '' };
  if (entry.label === 'Dark chocolate sauce') return { ...entry, itemId: 'chocolate-syrup', itemConfirmed: true, note: 'Same chocolate sauce as the other drinks.' };
  if (recipe.recipeKey === 'espresso-hot' && entry.id === 'cup') return { ...entry, itemConfirmed: true, note: '' };
  if (recipe.recipeKey === 'black-coffee-hot' && entry.id === 'coffee') return groundsLine();
  return entry;
}

const CARD_MILK = [[/8-10 oz steamed milk/, '6.9 oz steamed milk'], [/6-8 oz cold milk/, '6.9 oz cold milk']];

function answerRecipes(now) {
  const base = { version: 1, effectiveFrom: now, changeNote: 'Added from the owner\'s answers. Ice amount matches the iced latte.' };
  const ice = () => ({ ...confirmed(line('ice', 'ice', 'Ice', fixed(4), 'oz', 'ice')), note: 'Same as the iced latte.' });
  const coldCup = () => confirmed(line('cup', 'cup', 'Cold cup', fixed(1), 'each', 'cold-cups'));
  const lid = () => ({ ...line('lid', 'consumable', 'Lid', fixed(1), 'each'), excluded: true, note: LIDS_NOTE });
  return [
    recipeVersion(base, { versionId: 'espresso-iced-answers-v1', recipeKey: 'espresso-iced', name: 'Espresso', temperature: 'iced', cupType: 'Cold cup', espressoShots: 1, versionLabel: ANSWERS_LABEL, lines: [coldCup(), lid(), shot(1), ice()] }),
    recipeVersion(base, { versionId: 'black-coffee-iced-answers-v1', recipeKey: 'black-coffee-iced', name: 'Black Coffee', temperature: 'iced', cupType: 'Cold cup', versionLabel: ANSWERS_LABEL, lines: [coldCup(), lid(), groundsLine(), ice()] }),
  ].map((recipe) => ({ ...recipe, versionLabel: ANSWERS_LABEL }));
}

function answerItem(item) {
  const next = { ...item };
  const addNote = (text) => { if (!next.note) next.note = text; };
  if ((item.id === 'coffee-reg' || item.id === 'coffee-decaf') && next.ozPerShot == null) {
    next.ozPerShot = OZ_GROUNDS_PER_SHOT;
    addNote(`0.49 oz (14 g) of grounds per 2 oz shot. ${STANDARD}`);
  }
  if (OZ_PER_TBS[item.id] && next.ozPerTbs == null) {
    next.ozPerTbs = OZ_PER_TBS[item.id];
    addNote(`${OZ_PER_TBS[item.id]} oz per tablespoon. ${STANDARD}`);
  }
  // Sweet treat sleeves are counted one by one (100 on hand); they come 50 to a bundle, 6 bundles (300) to a box.
  if (item.id === 'sweet-treat-sleeves' && item.countUnit === 'bundle' && item.usagePerCount === 50) {
    Object.assign(next, { countUnit: 'sleeve', usageUnit: 'each', usagePerCount: 1 });
    addNote('50 sleeves per bundle, 6 bundles (300 sleeves) per box.');
  }
  return next;
}

export function applyAnswersUpdate(state, now = new Date().toISOString()) {
  if (state.settings?.appliedUpdates?.includes(ANSWERS_UPDATE)) return state;
  const supersede = new Set();
  const added = [];
  for (const recipe of state.recipes) {
    // Only recipes still at a version this app supplied; staff edits are left alone.
    if (recipe.supersededAt || recipe.versionLabel !== WORKSHEET_LABEL) continue;
    const lines = recipe.lines.map((entry) => answerLine(entry, recipe));
    const instructions = CARD_MILK.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), recipe.instructions || '');
    if (JSON.stringify(lines) === JSON.stringify(recipe.lines) && instructions === recipe.instructions) continue;
    supersede.add(recipe.versionId);
    added.push({ ...recipe, versionId: `${recipe.recipeKey}-answers-v${recipe.version + 1}`, version: recipe.version + 1, versionLabel: ANSWERS_LABEL, effectiveFrom: now, supersededAt: null, lines, instructions,
      changeNote: 'Owner answers: lids come with cups, no straws, confirmed inventory items, single milk amounts, industry-standard coffee and topping estimates.' });
  }
  const existingKeys = new Set(state.recipes.map((recipe) => recipe.recipeKey));
  const fresh = answerRecipes(now).filter((recipe) => !existingKeys.has(recipe.recipeKey));
  added.push(...fresh);
  const linkable = new Set(fresh.map((recipe) => recipe.recipeKey));
  return {
    ...state,
    products: state.products.map((product) => !product.recipeKey && linkable.has(product.id) ? { ...product, recipeKey: product.id } : product),
    recipes: [...state.recipes.map((recipe) => supersede.has(recipe.versionId) ? { ...recipe, supersededAt: now } : recipe), ...added],
    inventory: state.inventory.map(answerItem),
    settings: { ...state.settings, appliedUpdates: [...(state.settings?.appliedUpdates || []), ANSWERS_UPDATE] },
  };
}


// Monthly special (Nov 2026): one syrup bottle that holds whichever flavor is this
// month's special. Staff set the flavor's name in Staff → Products; it starts as
// Pumpkin Spice.
export const MONTHLY_UPDATE = 'monthly-special-2026-11';
const SPECIAL_ITEM_ID = 'monthly-special-syrup';

export function applyMonthlySpecialUpdate(state, now = new Date().toISOString()) {
  if (state.settings?.appliedUpdates?.includes(MONTHLY_UPDATE)) return state;
  const hasItem = state.inventory.some((item) => item.id === SPECIAL_ITEM_ID);
  const item = { id: SPECIAL_ITEM_ID, name: 'Monthly Special Syrup', sourceName: 'Owner request (Nov 2026)', category: 'Syrups & sauces', full: 0, onHand: 0, need: 0,
    countUnit: 'bottle', usageUnit: 'oz', usagePerCount: 24.5, ozPerPump: 0.25, ozPerShot: null, active: true,
    note: 'Whichever syrup is this month\'s special. Bottle size and pump match the other syrups; change them if the special comes in a different bottle.' };
  return {
    ...state,
    inventory: hasItem ? state.inventory : [...state.inventory, item],
    inventoryEvents: hasItem ? state.inventoryEvents : [...state.inventoryEvents, { id: `opening-${SPECIAL_ITEM_ID}`, type: 'opening', itemId: SPECIAL_ITEM_ID, itemName: item.name, countedValue: 0, at: now, by: 'App update', note: 'New item; record a restock or count when a bottle arrives' }],
    settings: { monthlySpecial: 'Pumpkin Spice', ...state.settings, appliedUpdates: [...(state.settings?.appliedUpdates || []), MONTHLY_UPDATE] },
  };
}

// The special first shipped as a flavored-latte choice; the owner asked for its own
// sales button instead. The button (hot and iced) is a flavored latte made with
// 3 pumps of Monthly Special Syrup, like the other flavors, and is named after this
// month's flavor. Sales already recorded as the latte choice keep that record.
export const SPECIAL_BUTTON_UPDATE = 'monthly-special-button-2026-11';
const SPECIAL_LABEL = 'Monthly special (Nov 2026)';
const SPECIAL_SOURCE = 'Owner request (Nov 2026)';
const specialSyrup = () => confirmed(line('flavor-special', 'syrup', 'Monthly Special Syrup', fixed(3), 'pump', SPECIAL_ITEM_ID));

function specialRecipe(recipes, temperature, now) {
  const hot = temperature === 'hot';
  const latte = recipes.find((recipe) => recipe.recipeKey === `latte-flavored-${temperature}` && !recipe.supersededAt);
  // The flavored latte without its flavor-specific syrups and drizzles.
  const base = latte ? latte.lines.filter((entry) => !entry.forOptions?.length)
    : latteLines(hot, [], { whipAlways: true }).filter((entry) => !entry.id.startsWith('drizzle')).map((entry) => answerLine(entry, {}));
  return {
    ...recipeVersion({ version: 1, effectiveFrom: now, changeNote: 'Monthly special: a flavored latte with 3 pumps of Monthly Special Syrup.' }, {
      versionId: `${SPECIAL_MENU_ID}-${temperature}-v1`, recipeKey: `${SPECIAL_MENU_ID}-${temperature}`, name: 'Monthly Special', temperature,
      cupType: hot ? 'Hot cup' : 'Cold cup', espressoShots: 1, lines: [...base, specialSyrup()],
    }),
    versionLabel: SPECIAL_LABEL, sourceDocument: SPECIAL_SOURCE,
  };
}

export function applySpecialButtonUpdate(state, now = new Date().toISOString()) {
  if (state.settings?.appliedUpdates?.includes(SPECIAL_BUTTON_UPDATE)) return state;
  // Take the choice back out of app-supplied flavored latte recipes.
  const supersede = new Set();
  const cleaned = [];
  for (const recipe of state.recipes) {
    if (recipe.supersededAt || recipe.versionLabel !== SPECIAL_LABEL || !recipe.lines.some((entry) => entry.forOptions?.includes(MONTHLY_SPECIAL))) continue;
    supersede.add(recipe.versionId);
    cleaned.push({ ...recipe, versionId: `${recipe.recipeKey}-special-moved-v${recipe.version + 1}`, version: recipe.version + 1, versionLabel: 'Special moved to its own button', effectiveFrom: now,
      lines: recipe.lines.filter((entry) => !entry.forOptions?.includes(MONTHLY_SPECIAL)), changeNote: 'The monthly special now has its own sales button.' });
  }
  let recipes = [...state.recipes.map((recipe) => supersede.has(recipe.versionId) ? { ...recipe, supersededAt: now } : recipe), ...cleaned];
  let { menuItems, products } = state;
  products = products.map((product) => product.options?.includes(MONTHLY_SPECIAL) ? { ...product, options: product.options.filter((option) => option !== MONTHLY_SPECIAL) } : product);
  if (!menuItems.some((entry) => entry.id === SPECIAL_MENU_ID)) {
    const price = products.find((product) => product.id === 'latte-flavored-hot')?.price ?? 3.5;
    menuItems = [...menuItems, { id: SPECIAL_MENU_ID, name: 'Monthly Special', order: Math.max(0, ...menuItems.map((entry) => entry.order)) + 1, kind: 'drink', active: true, reviewNote: '' }];
    for (const temperature of ['hot', 'iced']) {
      const recipe = specialRecipe(recipes, temperature, now);
      if (!recipes.some((entry) => entry.recipeKey === recipe.recipeKey)) recipes = [...recipes, recipe];
      products = [...products, { id: `${SPECIAL_MENU_ID}-${temperature}`, menuItemId: SPECIAL_MENU_ID, temperature, sourceName: SPECIAL_SOURCE, recipeKey: recipe.recipeKey, reviewNote: '', price, options: [], active: true }];
    }
  }
  return { ...state, menuItems, products, recipes, settings: { ...state.settings, appliedUpdates: [...(state.settings?.appliedUpdates || []), SPECIAL_BUTTON_UPDATE] } };
}

// The owner asked for plain Vanilla as a flavored-latte choice (no drizzle), next to the
// Vanilla + drizzle choices. App-supplied recipes get a new version whose vanilla syrup
// line also covers it; recipes staff have saved themselves are left alone.
export const VANILLA_UPDATE = 'plain-vanilla-2026-11';
const VANILLA = 'Vanilla';
const VANILLA_LABEL = 'Plain vanilla added (Nov 2026)';

export function applyVanillaUpdate(state, now = new Date().toISOString()) {
  if (state.settings?.appliedUpdates?.includes(VANILLA_UPDATE)) return state;
  const products = state.products.map((product) => {
    const at = product.options?.indexOf('Vanilla + chocolate drizzle') ?? -1;
    if (product.menuItemId !== 'cafe-latte-flavored' || at < 0 || product.options.includes(VANILLA)) return product;
    return { ...product, options: [...product.options.slice(0, at), VANILLA, ...product.options.slice(at)] };
  });
  const supersede = new Set();
  const added = [];
  for (const recipe of state.recipes) {
    if (recipe.supersededAt || recipe.savedBy || !recipe.recipeKey.startsWith('latte-flavored-')) continue;
    const vanilla = recipe.lines.find((entry) => entry.itemId === 'vanilla-syrup' && entry.forOptions?.includes('Vanilla + chocolate drizzle'));
    if (!vanilla || vanilla.forOptions.includes(VANILLA)) continue;
    supersede.add(recipe.versionId);
    added.push({ ...recipe, versionId: `${recipe.recipeKey}-vanilla-v${recipe.version + 1}`, version: recipe.version + 1, versionLabel: VANILLA_LABEL, effectiveFrom: now,
      changeNote: 'Plain Vanilla (no drizzle) added as a flavor choice.',
      lines: recipe.lines.map((entry) => entry === vanilla ? { ...entry, forOptions: [VANILLA, ...entry.forOptions] } : entry) });
  }
  const recipes = [...state.recipes.map((recipe) => supersede.has(recipe.versionId) ? { ...recipe, supersededAt: now } : recipe), ...added];
  return { ...state, products, recipes, settings: { ...state.settings, appliedUpdates: [...(state.settings?.appliedUpdates || []), VANILLA_UPDATE] } };
}

export const applyUpdates = (state, now) => [applyWorksheetUpdate, applyAnswersUpdate, applyMonthlySpecialUpdate, applySpecialButtonUpdate, applyVanillaUpdate].reduce((next, update) => update(next, now), state);
