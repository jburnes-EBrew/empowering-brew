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
- `src/staff.jsx` — Staff workspace tabs: Products, Recipes, Inventory, Reports, History. Reports also holds the Backups, Staff PIN and Clear practice data panels.
- `src/data.js` — seed menu, products, recipes, inventory, `SHOP_HOURS`, `SCHEMA_VERSION`.
- `src/estimates.js` — recipe usage estimates, drink changes (`changeChoices`, `withChanges`, `latteAdditions`), inventory balances, weekly/bakery/busy-time reports.
- `src/updates.js` — one-time data updates applied on load (`applyUpdates`).
- `src/storage.js` — IndexedDB persistence (localStorage fallback), schema migration, PIN hashing.
- `src/backup.js` — sales CSV, full JSON backup/restore, daily reminder, `clearPractice`.
- `public/sw.js` — service worker (network-first).

## Rules that matter

- **Data lives only on each device.** Never add anything that could wipe or overwrite saved data on load. Shipping a data change for existing devices means a new one-time update in `src/updates.js`: give it an ID, add it to `applyUpdates`, record it in `settings.appliedUpdates`, and add a test in `updates.test.js`.
- **One-time updates never overwrite staff edits.** Products staff changed, and recipes with `savedBy`, are left alone.
- **Recipes are versioned.** A change supersedes the current version (`supersededAt`) rather than editing it; past sales keep the `recipeVersionId` they were made with.
- **Bump the cache name in `public/sw.js`** (`empowering-brew-vN`) on every deploy.
- **Shop hours:** 10 AM–2 PM, Mon/Tue/Thu/Fri (`SHOP_HOURS`). Reports show open days only and leave out sales on closed days. Daily backup reminder defaults to 2:15 PM.
- **Sales:** drink changes adjust the inventory estimate, not the price. Student drinks are `price: 0, studentDrink: true`, still count against inventory, and are left out of Busy times. The bakery treat (food) records in one tap.
- **Bakery excess** is an inventory event `type: 'bakery-excess'` with `count` and `forDate`; it has no `itemId`, so it doesn't touch balances.
- **Keep the printable guides in sync.** When app behavior or screens change, update the guides in `Guides/` (Getting Started, App Tour, Backup & Restore, and the Student Guide, which is written for students with varying support needs: short steps, pictures, plain words).
- **Out of scope for now:** drink-ticket printing is on hold for budget. Don't build it.

## Style

- Match the existing code: small components in the same file, short comments that explain *why*, plain-language UI text written for students and staff, not developers.
- UI wording in the app and the guides should agree (for example "No changes — record drink", "Excess bakery items", "Clear practice data").
- Commit messages end with the project's Co-Authored-By trailer.
