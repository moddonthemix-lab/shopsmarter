# Florida Grocery Saver

A personal app that finds the cheapest place to buy your whole grocery list across **Walmart, Aldi, Publix and
Winn-Dixie**, and tells you whether a second stop is actually worth the gas.

Built with Expo (runs on iPhone, Android and the web). No account or server needed; everything is saved on your
device.

## How to use it

1. **My Lists:** type or paste items (`2 milk`, `eggs x3`, one per line or comma-separated), or describe your week
   ("Need food for tacos and breakfast") and it builds the list. Save lists as templates to reuse every week.
2. **Compare prices:** see each store's total, the cheapest store, whether a split trip saves money after gas, and
   which items are cheaper somewhere else.
3. **Start shopping:** a checklist grouped by store in driving order. Tick items off as they go in the cart.
4. **Keep prices real:** the app ships with **sample prices**. Tap any price (in a comparison, the shopping
   checklist or the **Prices** tab) and enter what you see on the shelf or your receipt. Your prices are marked ✓,
   used for every future comparison, and tracked over time (price history and "price drops you've spotted" on the
   Deals tab). If a store carries something the app doesn't know about, use **+ add price**.
5. **Settings:** your car's MPG, gas price, home location (for driving distances), which stores you shop at, and
   **Backup**. Copy a backup now and then (it's just text, so paste it into a note), especially on iPhone where
   Safari can clear website data for sites you haven't added to your home screen.

## Put it on your phone

### Option A: GitHub Pages (free, recommended)

The repo includes a workflow (`.github/workflows/deploy-pages.yml`) that builds and publishes the web app whenever
`main` is pushed.

1. On GitHub go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
   (If it says "Deploy from a branch", GitHub just renders this README as a web page instead of the app.)
2. Run the **Deploy web app to GitHub Pages** workflow (Actions tab → Run workflow). After that, every push to
   `main` or `claude/serene-hopper-9ors7u` redeploys automatically.
3. Open `https://<your-username>.github.io/shopsmarter/` on your phone and add it to your home screen: **Share → Add
   to Home Screen** in Safari, or **⋮ → Add to Home screen / Install app** in Chrome. It opens full screen with its
   own icon, and works offline once it has been opened (useful inside stores with bad signal).

GitHub Pages is free for public repositories; a private repo needs a paid GitHub plan for Pages. Your lists and
prices are never uploaded anywhere; they stay in your phone's browser storage.

### Option B: Railway

`railway.json` is included. Create a Railway project from this repo; it runs `npm run build:web` and serves the
app with `npm run serve:web` on Railway's `PORT`. Then open the Railway URL on your phone and add it to your home
screen the same way. Railway is a paid, always-on server, which this app doesn't need, so GitHub Pages is the
better fit.

### Option C: Expo Go (native app, while your computer is on)

```bash
npm install
npm start        # scan the QR code with the Expo Go app
```

For a permanent native install, build it with EAS (`npx eas-cli@latest build --profile preview`).

## Development

```bash
npm install
npm start            # dev server (press w for web)
npm test             # pricing engine tests
npx tsc --noEmit     # typecheck
npx expo lint
npm run build:web    # production web build in dist/ (EXPO_BASE_URL=/shopsmarter for a sub-path)
```

### How the savings math works

All pricing logic is plain TypeScript in `src/core/` and covered by tests.

- **Matching** (`matching.ts`): each list item is scored against every product's keywords and name; the best
  product per store wins. Weak matches are labelled "closest match".
- **Your prices** (`prices.ts`): your prices replace sample prices, sample deals revert to shelf price once they
  expire, and items you added are included.
- **Split trip** (`optimizer.ts`): every combination of your stores is tried, and each item goes to its cheapest
  store in that combination.
- **Driving** (`driving.ts`): nearest location of each chain to your home, the shortest round trip through the
  stops, road miles estimated as straight-line distance × 1.3, and fuel = miles ÷ MPG × gas price. You can also put
  a dollar value on your time.
- **Recommendation:** net savings = grocery savings − extra gas − extra time. A split trip is only recommended when
  that beats your minimum (default $3).

### Optional extras (not needed for personal use)

`supabase/` contains a Postgres schema and an OpenAI edge function for cloud sync, accounts and smarter
natural-language lists. They switch on only if `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set
(see `.env.example`). Without them the app is fully offline and the list builder uses a built-in meal dictionary.

## Project layout

```
src/
  app/                  screens (Expo Router)
    (tabs)/index.tsx    My Lists + list builder + templates
    (tabs)/prices.tsx   price book: every item × store, tap to update
    (tabs)/deals.tsx    your price drops + weekly specials
    (tabs)/settings.tsx driving costs, home, stores, backup
    list/[id].tsx       list editor
    compare/[id].tsx    comparison, split trip, gas, substitutions
    shop/[id].tsx       in-store checklist
    price.tsx           enter/update a price, price history
  core/                 pricing engine, sample catalog, tests
  state/AppState.tsx    on-device storage
public/                 web app manifest, icons, index.html
scripts/postexport.mjs  prepares dist/ for static hosting
```
