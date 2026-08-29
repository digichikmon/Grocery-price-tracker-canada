# Grocery Tracker Canada 🍁

A static, no-build web app for tracking grocery purchases store by store
(Costco, Walmart, IGA, or any other store you add), across Canada.

Plain HTML / CSS / JS — no framework, no bundler, no backend. All data is
stored locally on your device (`localStorage`), so it works offline and
needs no account. Deploys as-is to GitHub Pages.

## Features

- **Stores & products** — add any store, then log products under it with
  brand, unit/size, and notes.
- **Price history & change alerts** — every time you log a price for a
  product, it's compared to the last price you paid, and the app shows you
  whether it went up or down and by what percentage.
- **Repurchase reminders** — set "remind me every N days" per product; the
  dashboard bell and reminders list surface anything due.
- **Cart & Quebec tax** — pick a store, tick what's going in the cart, and
  get a running subtotal plus TPS (GST, 5%) and TVQ (QST, 9.975%), each
  calculated only on items you've marked taxable (basic groceries are
  zero-rated in Canada, so leave those unchecked).
- **Location-aware shopping list** — save your GPS position against a store
  once (while you're there), then tap "Find my store" anywhere to see the
  nearest saved store and what's still on your list for it.
- **Backup / restore** — export/import your whole dataset as JSON from
  Settings, e.g. to move between devices.

## Running it

No build step. Just open `index.html`, or serve the folder statically:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

Geolocation requires a secure context (HTTPS, or `localhost`) — it will not
work over plain `http://` on a non-localhost host.

## File structure

```
index.html       app shell — all views live here, shown/hidden by js/app.js
css/style.css    all styling
js/db.js         localStorage data layer (stores, products, price history)
js/tax.js        Quebec TPS/TVQ tax calculation
js/geo.js        geolocation + nearest-store distance helpers
js/app.js        UI wiring: routing between views, rendering, event handlers
manifest.json    PWA manifest ("Add to Home Screen" on a phone)
assets/icon.svg  app icon
```

## Notes

- Tax rates are Quebec's: GST/TPS 5%, QST/TVQ 9.975%, each applied to the
  pre-tax subtotal independently (not compounded) — the rule since 2013.
  Mark an item "taxable" only if it isn't a zero-rated basic grocery item.
- A store's location is only set when you tap "Save my current location as
  this store" while physically there — there's no geocoding step, so the
  app never guesses a store's address into coordinates.
