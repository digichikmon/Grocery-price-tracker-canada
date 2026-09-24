# Grocery Tracker Canada 🍁

A grocery-purchase tracker for Canada — store by store (Costco, Walmart, IGA,
or any store you add), with price-change alerts, repurchase reminders, a
Quebec-tax cart calculator, and a location-aware shopping list.

The app itself is plain HTML / CSS / JS with no framework and no backend —
all data lives on-device (`localStorage`). It ships three ways from one
codebase:

1. **A website** — the `docs/` folder, deployable as-is to GitHub Pages.
2. **An Android app** — the `android/` Capacitor project.
3. **An iOS app** — the `ios/` Capacitor project.

[Capacitor](https://capacitorjs.com) wraps the same web app in a native
shell so Android/iOS get real GPS permission prompts and OS-level
notifications instead of browser-only equivalents, without maintaining a
separate native codebase.

## Features

- **Stores & products** — add any store, then log products under it with
  brand, unit/size, and notes.
- **Price history & change alerts** — every time you log a price for a
  product, it's compared to the last price you paid, and the app shows you
  whether it went up or down and by what percentage.
- **Repurchase reminders** — set "remind me every N days" per product. The
  dashboard always shows what's due; on Android/iOS this also schedules a
  real OS notification for the due date.
- **Cart & Quebec tax** — pick a store, tick what's going in the cart, and
  get a running subtotal plus TPS (GST, 5%) and TVQ (QST, 9.975%), each
  calculated only on items you've marked taxable (basic groceries are
  zero-rated in Canada, so leave those unchecked).
- **Location-aware shopping list** — save your GPS position against a store
  once (while you're there), then tap "Find my store" anywhere to see the
  nearest saved store and what's still on your list for it.
- **Backup / restore** — export/import your whole dataset as JSON from
  Settings, e.g. to move between devices.

## Running the website

No build step needed to just try it. Serve `docs/` statically:

```bash
cd docs && python3 -m http.server 8080
# then visit http://localhost:8080
```

Geolocation requires a secure context (HTTPS, or `localhost`) — it will not
work over plain `http://` on a non-localhost host.

**GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / `docs`.
Requires the repo to be public (or a paid GitHub plan) to serve Pages for
free.

## Building the Android app

Requires [Android Studio](https://developer.android.com/studio) (or the
Android SDK + a JDK) — this repo's own dev sandbox has no internet access to
Google's SDK servers, so the Android project here is buildable but not
pre-built.

```bash
npm install
npx cap sync android      # after any change under docs/
npx cap open android      # opens Android Studio
```

From Android Studio: **Run** for a debug build on a device/emulator, or
**Build → Generate Signed Bundle/APK** for a release `.aab` to upload to
[Google Play Console](https://play.google.com/console) (one-time $25
registration fee).

A GitHub Actions workflow (`.github/workflows/android.yml`) also builds a
debug APK on every push and uploads it as a downloadable artifact — useful
for testing on a device without installing Android Studio at all.

## Building the iOS app

Requires a Mac with Xcode. This repo's own dev sandbox runs Linux and cannot
build or sign iOS apps at all.

```bash
npm install
npx cap sync ios          # after any change under docs/
npx cap open ios          # opens Xcode
```

From Xcode: **Product → Run** for the simulator, or **Product → Archive**
to upload to [App Store Connect](https://appstoreconnect.apple.com)
(requires a $99/year Apple Developer Program membership plus a signing
certificate and provisioning profile).

If you don't have a Mac, `.github/workflows/ios.yml` builds the project on
a macOS GitHub Actions runner on every push (unsigned, simulator target) —
proof the project compiles cleanly. Once you have an Apple Developer
account, that workflow is the place to add a real archive + signed export
step using certificates stored as repo secrets.

## Publishing checklist

Neither store submission can be automated from here — both require your own
authenticated developer account:

- **Google Play**: create a Play Console account, create an app listing
  (screenshots, description, privacy policy — required since this app
  requests location and notification permissions), upload a signed `.aab`,
  submit for review.
- **Apple App Store**: create an App Store Connect record, fill in the same
  kind of listing info, archive + upload a signed build from Xcode (or via
  CI once set up), submit for review.

## File structure

```
docs/               the actual web app — also the Capacitor webDir
  index.html         app shell — all views live here, shown/hidden by js/app.js
  css/style.css       all styling
  js/db.js            localStorage data layer (stores, products, price history)
  js/tax.js           Quebec TPS/TVQ tax calculation
  js/geo.js           location + nearest-store distance helpers (Capacitor Geolocation, web fallback)
  js/notifications.js native repurchase-reminder notifications (no-ops on web)
  js/app.js           UI wiring: routing between views, rendering, event handlers
  js/vendor/          vendored Capacitor runtime + plugin browser builds (no bundler in this repo)
  manifest.json       PWA manifest ("Add to Home Screen" on a phone, for the website build)
  assets/icon.svg     app icon
android/             Capacitor Android (Gradle) project — open in Android Studio
ios/                 Capacitor iOS (Xcode) project — open in Xcode
capacitor.config.json  app id, name, and webDir shared by both native projects
.github/workflows/   CI builds for Android (APK artifact) and iOS (compile check)
```

## Notes

- Tax rates are Quebec's: GST/TPS 5%, QST/TVQ 9.975%, each applied to the
  pre-tax subtotal independently (not compounded) — the rule since 2013.
  Mark an item "taxable" only if it isn't a zero-rated basic grocery item.
- A store's location is only set when you tap "Save my current location as
  this store" while physically there — there's no geocoding step, so the
  app never guesses a store's address into coordinates.
- `docs/js/vendor/` holds the browser (UMD) builds copied from the
  `@capacitor/*` npm packages. This project has no bundler, so plugin code
  is loaded via plain `<script>` tags in `docs/index.html` instead of
  `import` statements; re-copy those files from `node_modules/@capacitor/*/dist/`
  if you upgrade the Capacitor packages.
