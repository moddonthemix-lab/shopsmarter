# Florida Grocery Saver

Find the cheapest place to buy your whole grocery list across **Walmart, Aldi, Publix and Winn-Dixie**,
and whether a multi-store trip is actually worth the gas.

Built with Expo (React Native + web), Expo Router and Supabase.

## What works today

| Spec step | Status |
| --- | --- |
| **1. Create list:** type, paste (one per line / comma separated, `2 milk`, `eggs x3`), clipboard paste, keyboard dictation, duplicate, templates | ✅ |
| **Natural-language input:** “Need food for tacos, breakfast, and snacks this week.” | ✅ OpenAI via edge function, with an offline meal-dictionary fallback |
| **2. Match products:** fuzzy keyword matching picks the closest product at each store and flags loose matches | ✅ |
| **3. Price comparison:** per-store totals, cheapest store highlighted, missing items called out | ✅ |
| **4. Split-trip optimization:** every store combination is evaluated; items go to their cheapest store in the combo | ✅ |
| **5. Driving cost:** nearest location per chain, shortest round-trip route, fuel cost from MPG + gas price, optional value of time, **net savings** and a clear “worth it / not worth it” verdict | ✅ |
| Smart substitutions (“Publix milk is $1.54 more than Aldi”) | ✅ |
| Weekly deals: Publix BOGOs, Walmart Rollbacks, Aldi specials, Winn-Dixie promos (with “add to list”) | ✅ |
| Free plan: 10 comparisons / month; Pro plan preview | ✅ (billing not wired up) |
| Accounts: email/password, Google, Apple (Supabase Auth) + cloud list sync | ✅ when Supabase is configured |
| Price history, alerts, receipts | Schema ready (`price_history` is populated by a trigger); UI not built yet |
| Meal builder, family budget mode, receipt scanning, push notifications | Roadmap |

> **Prices are sample data.** `src/core/catalog.ts` holds an illustrative Tampa Bay catalog so the app works
> end to end without a backend. Real prices should be loaded into the Supabase `products` table by an ingestion job
> (retailer APIs/feeds, receipt scans) and fetched by the app instead of `SAMPLE_PRODUCTS`.

## How the savings math works

All of it is pure TypeScript in `src/core/` (no React), unit tested with Vitest.

1. **Matching** (`matching.ts`): each item is tokenized and scored against each product’s keywords (Jaccard) and title
   (containment). Best product per store above a threshold wins; scores below 0.8 are shown as “closest match”.
2. **Store totals** (`optimizer.ts`): price × quantity. Publix single BOGO items ring up at half price, so that is the
   effective unit price.
3. **Split trip**: for every non-empty subset of stores (15 for 4 stores), assign each item to its cheapest store in
   the subset. Subsets where a store gets no items are skipped.
4. **Driving** (`driving.ts`): pick the chain location nearest home, find the shortest round trip through the stops
   (brute force over visit orders), convert straight-line distance to road miles (×1.3), then
   `fuel = miles / mpg × gas price` and `time = drive minutes + 10 min per stop`.
5. **Recommendation**: the best split is the one with the lowest *true cost* (groceries + fuel + time).
   `net savings = (single-store total − split total) − extra fuel − extra time`. A split is recommended only when net
   savings beat the user’s minimum (default $3).

## Getting started

```bash
npm install
npm start          # Expo dev server – press w for web, or scan the QR code with Expo Go
npm test           # core pricing/matching/driving tests
npm run typecheck
```

Without any configuration the app runs fully offline: lists and settings are stored on the device.

### Supabase (accounts, sync, AI)

1. Create a Supabase project and copy `.env.example` to `.env.local`, filling in the URL and anon key.
2. Apply the schema: `supabase link --project-ref <ref>` then `supabase db push`
   (or paste `supabase/migrations/*.sql` into the SQL editor).
3. Auth → Providers: enable Email, Google and Apple. Add redirect URLs `grocerysaver://account` (native) and your web
   origin.
4. Natural-language input:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase functions deploy parse-grocery-list
   ```

### Database

`supabase/migrations/20260930000000_init.sql` creates the tables from the spec — `users`, `grocery_lists`,
`grocery_items`, `stores`, `products`, `price_history`, `alerts`, `receipts` — plus `store_locations` (for driving
distance) and `comparisons` (free-plan metering). Row level security limits user data to its owner; catalog tables are
public-read and written by the service role. A trigger appends to `price_history` whenever a product price changes.

## Project layout

```
src/
  app/                 Expo Router screens
    (tabs)/index.tsx   My Lists + AI list builder + templates
    (tabs)/deals.tsx   Weekly deals
    (tabs)/settings.tsx  MPG, gas price, time value, home location, plan, account
    list/[id].tsx      List editor
    compare/[id].tsx   Comparison, split trip, driving analysis, substitutions
    account.tsx        Sign in / sign up (email, Google, Apple)
  core/                Pure pricing engine + sample catalog (+ tests)
  lib/                 Supabase client, sync, AI parsing
  state/AppState.tsx   Local-first app state (AsyncStorage) with cloud sync
supabase/
  migrations/          Postgres schema + RLS
  functions/parse-grocery-list/  OpenAI natural-language → grocery items
```

## Roadmap

- Live price ingestion into `products`, and fetch the catalog from Supabase instead of the bundled sample.
- Price history charts and price-drop alerts (Firebase Cloud Messaging / Expo push).
- Receipt scanning (upload to Supabase Storage → OCR → `products` / `price_history`).
- Cheapest meal builder and family budget mode (budget → meal plan → list → store recommendation).
- Pro billing (App Store / Play subscriptions, e.g. via RevenueCat) setting `users.plan` server-side, and enforcing the
  free-plan quota via the `comparisons` table.
- More stores: Target, Costco, Sam’s Club, Trader Joe’s (add to `StoreId`, `STORES` and `STORE_LOCATIONS`).
- Google Maps Distance Matrix for real drive distances instead of the circuity estimate.
