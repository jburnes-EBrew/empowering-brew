# Online orders: Apps Script setup

Staff order ahead from a school-only web page; the order pops up on the shop iPad; students make it; the teacher pays at pickup and a student taps **Paid — record sale**, which records it like any other sale.

```
Staff phone/laptop ──(school sign-in)──> Staff order page ─┐
                                                           ├─> Google Sheet "Empowering Brew online orders"
Shop iPad (every 15 s) ──(secret key)──> iPad link ────────┘
```

Both links are **one Apps Script project deployed twice** with different access settings. Nothing secret is in these files; the sheet ID and iPad key are kept in Script Properties.

## One-time setup (about 10 minutes)

Do this signed in to your **usd497.org** Google account (any computer).

1. Go to [script.google.com](https://script.google.com) → **New project**. Name it `Empowering Brew online orders`.
2. **Project Settings** (gear) → check **Show "appsscript.json" manifest file in editor**.
3. In the editor, replace the contents of:
   - `Code.gs` with [`Code.gs`](Code.gs)
   - `appsscript.json` with [`appsscript.json`](appsscript.json)
   - Add an HTML file named **`Order`** (File **+** → HTML → `Order`) and replace its contents with [`Order.html`](Order.html).
4. Pick **`setup`** in the function menu and click **Run**. Approve the permissions (Sheets, triggers, your email address).
   It creates the order sheet, an iPad key and a nightly cleanup. Open **Execution log** to see the sheet link and the **iPad link key**.
5. **Deploy → New deployment → Web app**, twice:

   | Description | Execute as | Who has access | Use |
   |---|---|---|---|
   | `Staff order page` | Me | **Anyone within usd497.org** | Share this URL with staff |
   | `iPad link` | Me | **Anyone** | Paste into the iPad |

   The iPad link has to be "Anyone" because the iPad app runs on github.io and the browser won't send a school sign-in there. Every call to it needs the key, and the order page itself still requires a usd497.org sign-in on either link.
6. On the shop iPad: **Staff → Reports → Online orders**. Paste the **iPad link** URL and the key, tap **Test and save**, then check **Take online orders on this iPad**. An **Orders** button appears on the sales screen.
7. Share the **Staff order page** URL with staff (email, a QR code by the register, the staff site).

Use only one iPad for orders.

## How it behaves

- **Open only when someone will see it.** The order page takes orders on shop days (Mon, Tue, Thu, Fri) from 10:00 until 1:50, last call 10 minutes before closing. The iPad also has to have checked in within the last 2 minutes and not be paused. Hours come from the iPad (`SHOP_HOURS`).
- **Menu stays in sync.** The iPad sends its menu (active drinks, prices, flavors, the monthly special, and the Take off / Add or swap choices) whenever it changes. The order page only accepts orders that match it.
- **On the iPad:** a popup and chime for each new order, plus an **Orders** button with a count. **Start making → Ready → Paid — record sale**, or **Not picked up** / **Can't make it**. **Pause new orders** is for rushes. **Undo** on a recorded order puts it back on the list as Ready.
  - The chime needs one tap on the screen first (Safari's rule); the first sale of the day takes care of it.
- **For the teacher:** their orders today, with live status (Received → Being made → Ready). They can cancel until students start the drink. Each person can have up to 3 orders waiting.
- **The sheet:** one row per order. Orders older than 14 days are deleted at 3 AM. Recorded orders keep the iPad's sale ID.

Settings at the top of `Code.gs`: `ALLOWED_DOMAIN`, `PICKUP_CHOICES`, `LAST_CALL_MINUTES`, `IPAD_QUIET_MINUTES`, `MAX_OPEN_ORDERS`, `KEEP_DAYS`.

## Updating the script later

Paste the new files, then **Deploy → Manage deployments**. Edit **each** deployment (pencil) → Version: **New version** → Deploy. The URLs stay the same.

## If something goes wrong

- **iPad says "key is not right":** run `showSetup` and copy the key again. To replace a key that got out, run `newKey` and enter the new key on the iPad.
- **iPad says it got "a web page instead of orders":** the iPad has the order page URL, or the iPad link isn't set to **Anyone**.
- **Order page says the shop isn't taking orders during open hours:** the iPad app isn't open, is offline, or **Take online orders** is off.
- The iPad link URL and key are part of the iPad's **full backup**, so restoring a backup on a new iPad brings them along.
