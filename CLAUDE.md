# Empowering Brew

iPad sales and inventory PWA for the Empowering Brew student coffee shop (React 19 + Vite 8, no backend). Students record sales on the shop iPad; staff manage products, recipes, inventory and reports behind a shared PIN.

- Live: https://jburnes-ebrew.github.io/empowering-brew/
- Owner contact shown in the app and guides: jennifer.burnes@usd497.org (never a personal address)
- **This repo is public.** Source workbooks, worksheets and photos live in `Inputs/`, printable guides in `Guides/`; both are git-ignored and must stay that way.

## Commands

```bash
npm run dev      # Vite on 127.0.0.1:5173
npm test         # vitest run (all tests must pass before a commit)
npm run build
```

Deploy = push to `main`; GitHub Actions publishes to Pages (`.github/workflows/deploy.yml`). Watch with `gh run watch`.

## Layout

- `src/App.jsx` — student sales screen: HOT/ICED tabs, drink buttons, the drink box (`DrinkPicker`: flavor → green "No changes — record drink" or Take off / Add or swap → blue record button), Student drink and Decaf toggles (next drink only), Undo, Count screen.
- `src/staff.jsx` — Staff workspace tabs: Products, Recipes, Inventory, Reports, History. Reports holds the Backups and Staff PIN panels, then the Reorder list, Weekly over/under, Weekly sales, Bakery items and Busy times.
- `src/data.js` — seed menu, products, recipes, inventory, `SHOP_HOURS`, `SCHEMA_VERSION`.
- `src/estimates.js` — recipe usage estimates, drink changes (`changeChoices`, `withChanges`, `latteAdditions`), inventory balances, reorder/weekly/bakery/busy-time reports.
- `src/updates.js` — one-time data updates applied on load (`applyUpdates`).
- `src/storage.js` — IndexedDB persistence (localStorage fallback), schema migration, PIN hashing.
- `src/backup.js` — sales CSV, full JSON backup/restore, daily reminder.
- `public/sw.js` — service worker (network-first).

## Rules that matter

- **Data lives only on each device.** Never add anything that could wipe or overwrite saved data on load. Shipping a data change for existing devices means a new one-time update in `src/updates.js`: give it an ID, add it to `applyUpdates`, record it in `settings.appliedUpdates`, and add a test in `updates.test.js`.
- **One-time updates never overwrite staff edits.** Products staff changed, and recipes with `savedBy`, are left alone.
- **Recipes are versioned.** A change supersedes the current version (`supersededAt`) rather than editing it; past sales keep the `recipeVersionId` they were made with.
- **Bump the cache name in `public/sw.js`** (`empowering-brew-vN`) on every deploy.
- **Shop hours:** 10 AM–2 PM, Mon/Tue/Thu/Fri (`SHOP_HOURS`). Reports show open days only and leave out sales on closed days. Daily backup reminder defaults to 2:15 PM.
- **Sales:** drink changes adjust the inventory estimate, not the price. Student drinks are `price: 0, studentDrink: true`, still count against inventory, and are left out of Busy times. The bakery treat (food) records in one tap.
- **Bakery excess** is an inventory event `type: 'bakery-excess'` with `count` and `forDate`; it has no `itemId`, so it doesn't touch balances.
- **Packaging:** each bakery treat sale uses 1 sweet treat sleeve + 1 small sticker (the treat itself is an excluded line). Every hot drink with a hot cup sleeve also uses 1 large sticker. Stickers are counted by the sheet: large = 6 per sheet; small stickers per sheet is still unknown.
- **Par:** `item.full` is par. Below-par items show "Need N more to reach par" (not "Below par", which staff misread as a count). The Reorder list in Reports lists them with Need and Order (rounded up to whole count units) and downloads as CSV for the person who orders.
- **Weekly over/under** (`overUnderReport`): per item in a finalized count, real use since its last count (last count + restocks − this count) vs. recipe use from sales plus recorded waste. Items whose last count was the opening balance are skipped, so the first report comes after the second real count. About right = within 10% or a quarter unit. Real use below zero flags a likely missed delivery. The student page ("How did we do this week?") is portaled to `<body>` so it prints alone; it's for teaching, so keep its wording plain.
- **Deliveries:** Inventory → Record delivery enters a packing slip at once; each line is a `restock` event (shared `deliveryId`, note "Delivery: …") that adds to the estimate. It is not a count.
- **Counts are in each item's count unit** (`countUnit`), e.g. sweet treat sleeves are counted one by one, coffee by the bag.
- **Keep the printable guides in sync.** When app behavior or screens change, update the guides in `Guides/` (Getting Started, App Tour, Backup & Restore, and the Student Guide, which is written for students with varying support needs: short steps, pictures, plain words).
- **Go-live:** practice data was cleared and the baseline inventory count done on Nov 4, 2026; real tracking starts Nov 5, 2026. The Clear practice data button was then removed; the app is in production, so don't add data-wiping tools back.
- **Out of scope for now:** drink-ticket printing is on hold for budget. Don't build it.

## Style

- Match the existing code: small components in the same file, short comments that explain *why*, plain-language UI text written for students and staff, not developers.
- UI wording in the app and the guides should agree (for example "No changes — record drink", "Excess bakery items", "Weekly over/under").
- Commit messages end with the project's Co-Authored-By trailer.
