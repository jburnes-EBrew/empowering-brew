# Empowering Brew

iPad sales and inventory tracker for the Empowering Brew student coffee shop.

- **Sales screen:** Hot / Iced selector with one large button per menu item. Every sale records the product, its temperature, and (for flavored lattes) the flavor.
- **Staff workspace (PIN protected):** products, recipes, inventory, weekly reports, and history.
- **Recipes:** loaded from the Pinckney Panther recipe cards and fully editable. Use **Change syrup pumps** for quick pump changes, or **Edit full recipe** for anything else. Every save is a new version, and past sales keep the recipe they were made with.
- **Inventory:** estimated usage from sales, waste/spill/restock/remake tracking, and student physical counts that staff review before balances change.

All data is stored on the device (browser storage). Each iPad keeps its own records; use **Reports → Export CSV** to save sales off the device.

See `menu-recipe-inventory-validation.md` for the menu, recipe and inventory validation and the list of details still needed for complete estimates.

## Run on a computer

```bash
npm install
npm run dev
```

Then open the address it prints (http://127.0.0.1:5173/).

```bash
npm test        # run the tests
npm run build   # build the app into dist/
```

## Publish with GitHub Pages

1. Push this repository to GitHub on the `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs the tests and publishes the app. The address appears under **Settings → Pages** (usually `https://<username>.github.io/<repository>/`).
4. On the iPad, open that address in Safari, then **Share → Add to Home Screen**.
