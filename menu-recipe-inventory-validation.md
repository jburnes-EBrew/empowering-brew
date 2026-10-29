# Empowering Brew menu, recipe, and inventory validation

Status: re-verified 2026-10-27 against all four inputs (no source changes since the first validation; the recipe PDF in `Inputs` is still the 2026-09-29 old copy). The app now uses schema v3: recipe versions, ingredient estimates, a ledger-based inventory, and reviewed physical counts. The 10 card recipes are loaded as `Recipe cards v1` and are fully editable in Staff → Recipes (quick **Change syrup pumps** editor, or **Edit full recipe**); every save is a new version.

## Source coverage

| Source | Sheets | Tables | Reviewed content |
|---|---:|---:|---|
| Empowering Brew Daily data.numbers | 1 (`Sheet 1`) | 1 (`Empowering Brew Weekly Coffee Sales Date: _________________`) | All 18 rows and 6 columns; 16 product rows |
| coffee shop inventory.numbers | 1 (`Sheet1`) | 1 (`Table 1`) | All 1,012 allocated rows and 26 columns; 39 populated inventory rows in columns A:D |
| pinckney_panther_10_hot_and_iced_recipe_cards_5x7.pdf | 10 pages | n/a | All 10 recipe cards, visually checked after rendering |
| IMG_3166.jpg | n/a | n/a | Current public menu names, prices, flavors, temperature availability, Espresso, and Bakery Sweet Treats; not used as recipe evidence |

## 1. Complete menu extracted from the sales workbook

These names reproduce the source text, including capitalization, punctuation, spacing, and likely spelling errors. Hot and iced rows remain distinct sale products.

| Source row | Original product name | Temperature classification | Review note |
|---:|---|---|---|
| 3 | Cafe Latte - no flavor HOT | Hot | No recipe card supplied |
| 4 | Cafe Latte - no flavor ICED | Iced | No recipe card supplied |
| 5 | Cafe Latte - flavored HOT | Hot | No recipe card supplied; flavor is not identified |
| 6 | Cafe Latte - flavored - ICED | Iced | No recipe card supplied; extra hyphen and flavor is not identified |
| 7 | Rock Chalk Marsh Mocha - HOT | Hot | Possible recipe-name mismatch: card says `ROCK CHALK JAYHAWK MARSHMALLOW MOCHA` |
| 8 | Rock Chalk Marsh Mocha - ICED | Iced | Possible recipe-name mismatch: card says `ROCK CHALK JAYHAWK MARSHMALLOW MOCHA` |
| 9 | Panther paw Caramel Latte - HOT | Hot | `paw` capitalization differs from the iced row and recipe card |
| 10 | Panther Paw Caramel Latte - ICED | Iced | Candidate match to the recipe card |
| 11 | Black Panther Mocha - HOT | Hot | Exact name match to hot recipe card after removing the temperature suffix |
| 12 | Black Panther Mocha -  ICED | Iced | Exact words, but the source has two spaces before `ICED` |
| 13 | Panther Pride Cinnamon Roll Latte - HOT | Hot | Exact name match to hot recipe card after removing the temperature suffix |
| 14 | Panther Pride Cinnamon Rolle Latte - ICED | Iced | `Rolle` differs from the recipe card's `Roll` |
| 15 | Pinckney Pride Cookie Mocha - HOT | Hot | Recipe card says `PINCKNEY PANTHER COOKIE MOCHA`; staff must confirm identity |
| 16 | Pinckney Pride Cooke. Mocha - ICED | Iced | `Pride`/`Panther` and `Cooke.`/`Cookie` differ from the recipe card |
| 17 | Black Coffee | Ambiguous, likely hot | Name contains no explicit temperature; no recipe card supplied |
| 18 | Hot Tea | Hot | No recipe card supplied |

Summary: 16 tracked sale products: 9 hot or apparently hot, and 7 iced. There are no exact duplicate rows. There are several inconsistent or ambiguous names that should be resolved by staff, not auto-corrected.

The weekday header row contains `Monday`, `Tuesday`, a blank column, `Thursday`, and `Friday `. The blank column may be Wednesday, but it must be labeled by staff rather than inferred. The table title also leaves the sales date blank.

### Current menu photo update

The current menu photo resolves the customer-facing names as:

- Rock Chalk Jayhawk Marshmallow Mocha
- Pinckney Panther Cookie Mocha
- Black Panther Mocha
- Panther Pride Cinnamon Roll Latte
- Panther Paw Caramel Latte
- Cafe Latte
- Espresso

It lists all drinks at `$3.50`, identifies `Bakery Sweet Treats` at `$2.50`, and says all drinks are available hot or iced. The user separately confirmed that Black Coffee is hot. The app therefore keeps the workbook's hot-only Black Coffee and Hot Tea rows, adds hot and iced Espresso, and adds one non-temperature Bakery Sweet Treat product.

The Cafe Latte flavor choices shown are Chocolate, Vanilla, Cookie, Caramel, Cinnamon Sugar, Sugar-Free Chocolate, and Sugar-Free Vanilla. The app records this choice as a sales modifier. The photo's descriptions and flavor list are menu information only and are not used to calculate ingredients.

## 2. Ten specialty recipe variations

Provisional recipe source/version for all rows: the supplied old placeholder PDF, metadata creation date September 29, 2026. The cards do not print a recipe version number.

| Card | Drink and temperature | Cup | Espresso | Syrups and sauces | Milk | Ice | Toppings/finish | Preparation |
|---:|---|---|---:|---|---|---|---|---|
| 1/10 | Rock Chalk Jayhawk Marshmallow Mocha - Hot | 16 oz paper cup | 2 shots | 4 pumps chocolate sauce; 3 pumps toasted marshmallow | 8-10 oz steamed milk | None stated | Whipped cream; chocolate drizzle; mini marshmallows | Add flavors. Pull 2 shots, add to cup, and stir. Add steamed milk. Finish with toppings. |
| 2/10 | Panther Paw Caramel Latte - Hot | 16 oz paper cup | 2 shots | 3 pumps caramel syrup; 1 pump vanilla syrup | 8-10 oz steamed milk | None stated | Whipped cream; caramel drizzle | Add flavors. Pull 2 shots, add to cup, and stir. Add steamed milk. Finish with toppings. |
| 3/10 | Black Panther Mocha - Hot | 16 oz paper cup | 2 shots | 4 pumps dark chocolate sauce; 1 pump vanilla syrup | 8-10 oz steamed milk | None stated | Whipped cream; chocolate drizzle | Add flavors. Pull 2 shots, add to cup, and stir. Add steamed milk. Finish with toppings. |
| 4/10 | Panther Pride Cinnamon Roll Latte - Hot | 16 oz paper cup | 2 shots | 3 pumps brown sugar cinnamon; 1 pump vanilla syrup | 8-10 oz steamed milk | None stated | Whipped cream; cinnamon sugar | Add flavors. Pull 2 shots, add to cup, and stir. Add steamed milk. Finish with toppings. |
| 5/10 | Pinckney Panther Cookie Mocha - Hot | 16 oz paper cup | 2 shots | 3 pumps chocolate sauce; 3 pumps cookie butter syrup | 8-10 oz steamed milk | None stated | Whipped cream; cookie crumbs | Add flavors. Pull 2 shots, add to cup, and stir. Add steamed milk. Finish with toppings. |
| 6/10 | Rock Chalk Jayhawk Marshmallow Mocha - Iced | 16 oz clear cup | 2 shots | 4 pumps chocolate sauce; 3 pumps toasted marshmallow | 6-8 oz cold milk | Fill the rest of the cup with ice | Whipped cream; chocolate drizzle; mini marshmallows | Add flavors. Pull 2 shots, add to cup, and stir. Add cold milk, fill with ice, and finish with toppings. |
| 7/10 | Panther Paw Caramel Latte - Iced | 16 oz clear cup | 2 shots | 3 pumps caramel syrup; 1 pump vanilla syrup | 6-8 oz cold milk | Fill the rest of the cup with ice | Whipped cream; caramel drizzle | Add flavors. Pull 2 shots, add to cup, and stir. Add cold milk, fill with ice, and finish with toppings. |
| 8/10 | Black Panther Mocha - Iced | 16 oz clear cup | 2 shots | 4 pumps dark chocolate sauce; 1 pump vanilla syrup | 6-8 oz cold milk | Fill the rest of the cup with ice | Whipped cream; chocolate drizzle | Add flavors. Pull 2 shots, add to cup, and stir. Add cold milk, fill with ice, and finish with toppings. |
| 9/10 | Panther Pride Cinnamon Roll Latte - Iced | 16 oz clear cup | 2 shots | 3 pumps brown sugar cinnamon; 1 pump vanilla syrup | 6-8 oz cold milk | Fill the rest of the cup with ice | Whipped cream; cinnamon sugar | Add flavors. Pull 2 shots, add to cup, and stir. Add cold milk, fill with ice, and finish with toppings. |
| 10/10 | Pinckney Panther Cookie Mocha - Iced | 16 oz clear cup | 2 shots | 3 pumps chocolate sauce; 3 pumps cookie butter syrup | 6-8 oz cold milk | Fill the rest of the cup with ice | Whipped cream; cookie crumbs | Add flavors. Pull 2 shots, add to cup, and stir. Add cold milk, fill with ice, and finish with toppings. |

Every card says `1 pump = 1/4 oz` and also instructs staff to confirm that each sauce pump dispenses 1/4 oz before student use. This conversion is provisional until each syrup/sauce dispenser is measured. Topping quantities are unspecified and remain unspecified.

## 3. Consolidated inventory list

The source does not define the units for `Full`, `On Hand`, or `Need`. Values below preserve the displayed workbook values.

| Item | Full | On Hand | Need |
|---|---:|---:|---:|
| Coffee Reg | 6 | 0 | 6 |
| Coffee Decaf | 1 | 0 | 1 |
| Hot Coco Mix | 1 | 1 | 0 |
| Whole Milk | 3 | 3 | 0 |
| Soy Milk | 1 | 1/2 | 0 |
| Whip | 4 | 3 | 1 |
| Caramel Drizzle | 2 | 1 | 1 |
| Dark Ch Drizzle | 2 | 1 | 1 |
| Lornadoones | 2 | 2 | 0 |
| Marshmallows | 2 | 1 | 1 |
| Cinnamon | 1 | 0.5 | 0 |
| Sugar Loose | 1 | 1 | 0 |
| Sugar Packets | 2 | 2 | 0 |
| Creamers  | 1 | 1 | 0 |
| Chocolate syrup | 4 | 2 | 2 |
| SF Chocolate Syrup | 2 | 2 | 0 |
| Vanilla Syrup | 4 | 2 | 2 |
| SF Vanilla Syrup | 2 | 1 | 1 |
| Cookie Butter Syrup | 3 | 3 | 0 |
| Brn Sugar Cinnamon Syrup | 3 | 3 | 0 |
| Toasted Marshmallow Syrup | 3 | 2 | 1 |
| Classic Caramel Syrup | 3 | 3 | 0 |
| Ice | 2 | 2 | 0 |
| Hot cups | 1 | 0.5 | 1 |
| Cold cups | 1 | 0.5 | 1 |
| Hot Cup Sleeves | 1 | 1 | 0 |
| Napkins | 1 | 1 | 0 |
| Paper Towels (Dispenser) | 1 | 1 | 0 |
| Paper Towels (Roll) | 12 | 11 | 0 |
| Stir Sticks | 1 | 1 | 0 |
| 2 Cup Holders | 3 | 3 | 0 |
| 4 Cup Holders | 1 | 1 | 0 |
| Gloves | 2 | 1 | 1 |
| Sweet Treat Sleeves | 200 | 100 | 100 |
| Emp Brew Stickers (large) | 1 | 1 | 0 |
| Emp Brew Stickers (Small) | 1 | 0 | 1 |
| Avery 5219 | 1 | 1 | 0 |
| Label Maker Tape (1/2in LT) | 1 | 1 | 0 |
| Hand Soap | 1 | 1 | 0 |

Inventory review flags:

- The `Soy Milk` on-hand cell displays `1/2`, but its underlying Numbers value is date-formatted and parses as January 2, 2026. Staff should replace it with an unambiguous numeric quantity and unit.
- `Need` values are hard-coded, not formulas. For example, cinnamon is 1 full and 0.5 on hand with need 0, while both cup rows are 1 full and 0.5 on hand with need 1. Staff should define the reorder/rounding rule.
- `Lornadoones` may be a product-name error or shorthand; do not rename it without confirmation.
- Recipe and inventory names are not always identical: `Chocolate sauce` versus `Chocolate syrup`, `Dark chocolate sauce` versus `Dark Ch Drizzle`/`SF Chocolate Syrup`, `Brown sugar cinnamon` versus `Brn Sugar Cinnamon Syrup`, `Whipped cream` versus `Whip`, and `mini marshmallows` versus `Marshmallows`.

## 4. Menu-to-recipe mapping

| Sales product | Recipe status | Candidate recipe / issue |
|---|---|---|
| Cafe Latte - no flavor HOT | Not configured | No card supplied |
| Cafe Latte - no flavor ICED | Not configured | No card supplied |
| Cafe Latte - flavored HOT | Not configured | No card supplied; flavor choice is unknown |
| Cafe Latte - flavored - ICED | Not configured | No card supplied; flavor choice is unknown |
| Rock Chalk Marsh Mocha - HOT | Confirmed display-name mapping | Rock Chalk Jayhawk Marshmallow Mocha - Hot; confirmed by user and current menu photo |
| Rock Chalk Marsh Mocha - ICED | Confirmed display-name mapping | Rock Chalk Jayhawk Marshmallow Mocha - Iced; confirmed by user and current menu photo |
| Panther paw Caramel Latte - HOT | Confirmed display-name mapping | Panther Paw Caramel Latte - Hot; current menu photo resolves capitalization |
| Panther Paw Caramel Latte - ICED | Exact | Panther Paw Caramel Latte - Iced |
| Black Panther Mocha - HOT | Exact | Black Panther Mocha - Hot |
| Black Panther Mocha -  ICED | Exact display name | Black Panther Mocha - Iced; source whitespace is retained separately |
| Panther Pride Cinnamon Roll Latte - HOT | Exact | Panther Pride Cinnamon Roll Latte - Hot |
| Panther Pride Cinnamon Rolle Latte - ICED | Confirmed display-name mapping | Panther Pride Cinnamon Roll Latte - Iced; current menu photo resolves `Rolle`/`Roll` |
| Pinckney Pride Cookie Mocha - HOT | Confirmed display-name mapping | Pinckney Panther Cookie Mocha - Hot; current menu photo resolves `Pride`/`Panther` |
| Pinckney Pride Cooke. Mocha - ICED | Confirmed display-name mapping | Pinckney Panther Cookie Mocha - Iced; current menu photo resolves both mismatches |
| Black Coffee | Not configured | No card supplied; user confirmed hot only |
| Hot Tea | Not configured | No card supplied |
| Espresso - HOT | Not configured | Added from current menu photo; no recipe supplied |
| Espresso - ICED | Not configured | Added from current menu photo; no recipe supplied |
| Bakery Sweet Treat | Not configured | Added from current menu photo; non-temperature product; specific treat type not listed |

Coverage after the current menu photo: 10 specialty drink variants have approved placeholder-recipe identity links. Nine tracked variants/products have no recipe: four Cafe Latte rows, Black Coffee, Hot Tea, hot Espresso, iced Espresso, and Bakery Sweet Treat. All remain saleable regardless of recipe status.

## 5. Missing information for reliable inventory calculations

### Required before consumption estimates can be trusted

1. Updated recipe cards and an explicit recipe version/effective date.
2. Staff-approved resolution of every candidate product-to-recipe mapping above.
3. A standard inventory milk amount for the hot `8-10 oz` range and iced `6-8 oz` range. Keep the original ranges in the recipe record.
4. Measured ounces per pump for every syrup/sauce dispenser. Store this on the ingredient-dispenser relationship so different pumps can have different volumes.
5. Default milk used by each recipe and the rules for substitutions such as soy milk.
6. Actual quantities for whipped cream, drizzles, mini marshmallows, cinnamon sugar, and cookie crumbs. Do not estimate these silently.
7. An ice usage standard, preferably by ounces/grams or a measured scoop, instead of `fill the rest of the cup`.
8. Espresso yield: bean/ground-coffee quantity per shot, whether `Coffee Reg` is the espresso input, and waste/purge assumptions.
9. Recipes for the four cafe-latte rows, Black Coffee, and Hot Tea. The flavored latte also needs the allowed flavors and amount for each flavor.
10. Package definitions and base units for all 39 inventory items: bottle/carton/bag/sleeve/case size, ounces or milliliters per container, pieces per package, and partial-container counting rules.
11. Exact cup and consumable mapping: confirm that `Hot cups` means 16 oz paper cups and `Cold cups` means 16 oz clear cups; add or identify hot lids, cold lids, straws, and any per-sale napkin/stir-stick/sleeve rules.
12. Confirmation of whether iced drinks use sleeves, dome/flat lids, and straws; whether hot drinks always use sleeves and lids; and whether toppings alter the lid type.
13. Staff-defined reorder rule for `Need`, including how partial containers are rounded.
14. Opening inventory date, count frequency, authorized reconcilers, and the approval workflow for student-entered physical counts.
15. Units and reason codes for restocking, waste, spills, remakes, and manual adjustments.

### Data model requirements to preserve history

- Give each product and temperature variation an immutable ID. Store the original display name separately from future staff-approved names.
- Let staff add, rename, reorder, deactivate, and reactivate products without deleting historical sales.
- Version recipes with effective start/end times. Every sale should retain the recipe-version ID used for its estimate.
- Record inventory as an event ledger: estimated sale usage, physical count, restock, waste, spill, remake, and staff reconciliation adjustment.
- A missing or unapproved recipe mapping should produce `ingredient estimate unavailable`, never block the sale.

## 6. iPad sales screen for the actual menu

The menu has 11 buttons (10 drink items plus Bakery Sweet Treat). They fit a single 3-by-4 grid on an 11-inch iPad, so the permanent Hot/Iced selector works without scrolling. Each **menu item** has one fixed grid position, shared by its hot and iced variants. A drink not offered in the selected temperature leaves a blank tile instead of letting later buttons slide up. Staff reorder menu items, not individual variants, so hot and iced always stay aligned. With 13 or more items the grid switches to four columns; past 16 it scrolls.

```text
HOT (10)                                       ICED (8)
+----------------+----------------+-----------+   +----------------+----------------+-----------+
| Cafe Latte     | Cafe Latte     | Rock Chalk|   | Cafe Latte     | Cafe Latte     | Rock Chalk|
| No Flavor      | Flavored *     | Jayhawk…  |   | No Flavor      | Flavored *     | Jayhawk…  |
+----------------+----------------+-----------+   +----------------+----------------+-----------+
| Panther Paw    | Black Panther  | Panther   |   | Panther Paw    | Black Panther  | Panther   |
| Caramel Latte  | Mocha          | Pride…    |   | Caramel Latte  | Mocha          | Pride…    |
+----------------+----------------+-----------+   +----------------+----------------+-----------+
| Pinckney       | Espresso       | Black     |   | Pinckney       | Espresso       | (blank)   |
| Panther Cookie |                | Coffee    |   | Panther Cookie |                |           |
+----------------+----------------+-----------+   +----------------+----------------+-----------+
| Hot Tea        | Bakery Sweet   |           |   | (blank)        | Bakery Sweet   |           |
|                | Treat          |           |   |                | Treat          |           |
+----------------+----------------+-----------+   +----------------+----------------+-----------+
* opens a one-tap flavor picker (7 menu flavors); the flavor is saved on the sale.
```

Interaction and accessibility rules:

- Persistent segmented selector at the top, with `HOT` plus a heat icon and warm amber styling, and `ICED` plus a snowflake icon and cool blue styling. Never rely on color alone.
- Large, high-contrast buttons with a minimum touch target of 60 by 60 points and labels that can wrap to two or three lines.
- One tap records a sale when the desired temperature mode is already active; changing temperature then choosing a product takes two taps.
- Record immutable product ID, temperature-variation ID, displayed product name, sale time, and recipe-version ID (or `not configured`) with every sale.
- Show a brief confirmation and an `Undo` action after each sale instead of adding a confirmation dialog to every transaction.
- Keep product order controlled by staff. Put add/rename/reorder/deactivate/reactivate controls behind an authorized staff screen, not on the student sales screen.
- Preserve these source names in the initial verification view. Apply corrected display names only after staff approves the flagged inconsistencies.
- Each button shows a text badge (`Hot` with a heat icon, or `Iced` with a snowflake), a colored top band, and a tinted background, so temperature never depends on color alone.
- Undo only reaches the sale just recorded on that screen, and keeps it in the log as voided instead of deleting it.

### Optional student physical-count screen

- Show one inventory category at a time with large item rows, a unit label, and plus/minus or numeric count entry.
- Save student counts as a draft count session. Do not immediately change the official on-hand balance.
- Let authorized staff review each draft, compare it with the estimated balance, enter a discrepancy reason, and finalize the reconciliation.
- Post finalized differences to the inventory event ledger as distinct reconciliation adjustments. Keep restocks, waste, spills, and remakes as separate event types.
- Preserve the pre-count estimate, submitted physical count, reviewer, time, reason, and resulting adjustment so later recipe changes never rewrite prior reconciliations.

## Verification decisions needed from staff

1. Choose standard inventory quantities inside the milk ranges.
2. Confirm pump volumes and ingredient-name mappings.
3. Supply the updated recipe set and missing recipes, including Espresso and the Cafe Latte variations.
4. Define packaging/base units, consumables per sale, and reconciliation/reorder rules.
5. Confirm whether Bakery Sweet Treat should remain one product or be split into specific baked-goods products later.


## Recipe-to-inventory link suggestions (staff must confirm)

The app pre-selects these inventory items on recipe lines, but every link starts **unconfirmed**. Only confirmed links count toward estimates.

| Recipe line | Suggested inventory item | Why it needs confirmation |
|---|---|---|
| 16 oz paper cup / 16 oz clear cup | Hot cups / Cold cups | Workbook does not state cup size |
| Hot cup sleeve | Hot Cup Sleeves | Card does not say a sleeve is used |
| Espresso (2 shots) | Coffee Reg | Unknown whether this is the espresso bean |
| Chocolate sauce | Chocolate syrup | Sauce vs syrup naming |
| Toasted marshmallow | Toasted Marshmallow Syrup | Near-exact name |
| Caramel syrup | Classic Caramel Syrup | Near-exact name |
| Vanilla syrup | Vanilla Syrup | Exact name |
| Brown sugar cinnamon | Brn Sugar Cinnamon Syrup | Abbreviated name |
| Cookie butter syrup | Cookie Butter Syrup | Exact name |
| Steamed milk / Cold milk | Whole Milk | Card does not name the milk type |
| Ice | Ice | No measured amount on card |
| Whipped cream, Caramel drizzle, Mini marshmallows, Cinnamon sugar | Whip, Caramel Drizzle, Marshmallows, Cinnamon | No quantities on card |
| Dark chocolate sauce, Chocolate drizzle, Cookie crumbs | none | No clear inventory match (`Dark Ch Drizzle` and `Lornadoones` are possible but unconfirmed) |
| Hot/cold cup lid, Straw | none | Not on card or inventory sheet; add items if used |

## How the app handles the missing information

- **Ranges** (milk 8-10 oz hot, 6-8 oz iced) are stored as ranges. Staff choose a standard amount (one tap on min, mid, or max, or type a value). Until then, milk shows as a gap.
- **Pump volume** is measured per dispenser (Inventory → Edit → *Measured ounces per pump*). A recipe line can override it for one drink. The cards' 1/4 oz is shown only as guidance and is never applied automatically.
- **Units**: each inventory item gets a counted unit (e.g. bottle) and a conversion (e.g. 25.4 oz per bottle). Usage that cannot be converted yet is shown on the item and is not deducted.
- **Every sale stores** its product ID, temperature, flavor, the recipe version ID, the computed usage lines, and the list of gaps at that moment. Later recipe edits create new versions and never change past sales.
- **Estimate status per sale**: Complete, Partial, Recipe needs setup, or Not configured. Sales are never blocked.
- **Inventory ledger**: opening balance (workbook On Hand) → restock / waste / spill / adjustment events → drink remakes and wasted drinks (recipe usage, kept separate from sales) → reviewed physical counts. Students submit counts; staff see estimated vs counted, choose a reason for each difference, and finalize or discard. Each reconciliation records the estimate, the count, the counter, the reviewer, and the reason.
- **Data safety**: saved data from the earlier prototype (schema v2) is migrated, keeping sales, events, counts, and the PIN. Unreadable data is backed up instead of overwritten.

## Owner decisions (2026-10-27)

- Spelling, spacing, hyphen and capitalization differences in the workbook names are fine as they are. The app no longer shows review notes for them. The exact workbook text is still kept as each product's source name.
- Flavored lattes can be any syrup listed on the menu. The flavor is chosen at the register for each sale. Pumps per flavor are still to come from the worksheet.

## Setup worksheets applied (2026-10-28)

Both worksheets in `Inputs/` were built in as a one-time update (`src/updates.js`). It runs once per device and fills only blank fields. It adds a new version for a recipe only when that device still has the card version, so recipe-card history and past sales are kept.

- Signature drinks: a new "Setup worksheet (Oct 2026)" version. Pumps are unchanged from the cards. Milk is 6.9 oz hot and iced, ice 2 oz, whip 4 Tbs, drizzles 2 Tbs and cinnamon sugar 0.1 oz. Inventory links are confirmed where the worksheet named an item.
- New recipes: Cafe Latte No Flavor and Cafe Latte Flavored (hot and iced), Espresso (hot), Black Coffee (hot) and Hot Tea.
- Flavored latte: 9 one-tap choices. Each uses its own syrup at 3 pumps. Drizzle follows the Latte flavors tab, and the student picks it for Vanilla and Sugar-Free Vanilla. Plain latte: No topping, Whipped topping, or whip plus chocolate or caramel drizzle.
- Black Coffee is now also offered iced, with no recipe yet. Hot Tea is hot only.
- Units and sizes were filled in from the worksheet. Interpretations: 20 lb ice bag = 320 oz. 2 Cup Holders are counted "each" (the sheet said oz). Espresso is counted in shots (the sheet said 2 oz = 2 shots). Hot cinnamon sugar is 0.1 oz (the unit cell said 0.1).
- Still flagged in the app: lids, straws and tea bags (no inventory items yet); ground coffee per espresso shot; brewed coffee vs. grounds; chocolate drizzle and cookie crumb items; Black Panther dark chocolate sauce item; Cinnamon Sugar syrup; Tbs-to-container conversions for whip, drizzles and toppings.

## Owner answers applied (2026-10-29)

These were added as a second one-time update ("Owner answers (Oct 2026)" recipe versions).

- Every cup comes with a lid, so lids are counted with the cups. No straws are used.
- Chocolate drizzle is Dark Ch Drizzle. Cookie crumbs are Lornadoones. Black Panther's dark chocolate sauce is the one Chocolate syrup. The Cinnamon Sugar latte uses Brn Sugar Cinnamon Syrup.
- Mini marshmallows are 2 oz. Milk is a single 6.9 oz amount; the outdated card ranges were dropped.
- Machine: KitchenAid KES8558. One shot is 2 oz of brewed espresso. Black coffee is 6.9 oz brewed by the machine.
- Industry-standard estimates, which the owner asked for until measured numbers exist:
  - Coffee: 14 g (0.49 oz) of grounds per 2 oz shot. Black coffee: 12 g (0.42 oz) per 6.9 oz cup.
  - Ounces per tablespoon from typical package labels: whip 0.088, chocolate and caramel drizzle 0.69, cookie crumbs 0.22.
- New recipes: iced Espresso and iced Black Coffee (ice 4 oz, the same as the iced latte).
- Decaf is a one-sale toggle on the sales screen. That drink's coffee comes out of Coffee Decaf, and the sales CSV has a Decaf column.
- Sweet Treat Sleeves are counted one by one. They come 50 per bundle and 6 bundles (300 sleeves) per box.
- Remaining gap: Hot Tea has no tea bag item on the inventory list.
