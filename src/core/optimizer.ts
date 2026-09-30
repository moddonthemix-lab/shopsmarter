import { round2, STORE_IDS } from './catalog';
import { nearestLocations, shortestRoundTrip, tripCost } from './driving';
import { CONFIDENT_MATCH, matchList } from './matching';
import type {
  DrivingSettings,
  GeoPoint,
  GroceryItem,
  ItemMatches,
  Product,
  StoreId,
  StoreLocation,
} from './types';

export interface PricedLine {
  item: GroceryItem;
  product: Product;
  storeId: StoreId;
  cost: number;
}

export interface StoreTotal {
  storeId: StoreId;
  total: number;
  lines: PricedLine[];
  /** Items this store doesn't carry (that some other store does). */
  missing: GroceryItem[];
}

export interface TripPlan {
  storeIds: StoreId[];
  /** Stores in the order they should be visited. */
  route: StoreLocation[];
  lines: PricedLine[];
  itemsTotal: number;
  miles: number;
  fuelCost: number;
  minutes: number;
  timeCost: number;
  /** Groceries + fuel + time: what the trip really costs. */
  trueCost: number;
}

export interface SplitAnalysis {
  plan: TripPlan;
  /** Grocery savings vs. the best single-store trip, before driving costs. */
  savingsBeforeGas: number;
  extraMiles: number;
  extraFuelCost: number;
  extraMinutes: number;
  extraTimeCost: number;
  /** Savings after subtracting extra fuel (and time, when valued). */
  netSavings: number;
  /** netSavings >= the user's minimum-worthwhile threshold. */
  worthIt: boolean;
}

export interface Comparison {
  matches: ItemMatches[];
  /** Sorted: full coverage first, then cheapest. */
  storeTotals: StoreTotal[];
  /** Items no store carries. */
  unmatched: GroceryItem[];
  /** Cheapest store that carries every comparable item. */
  bestSingle: TripPlan | null;
  /** Lowest grocery total from any combination of stores, ignoring driving. */
  cheapestCombination: TripPlan | null;
  /** Multi-store trip with the lowest true cost (groceries + driving). */
  bestSplit: SplitAnalysis | null;
}

export interface CompareOptions {
  home: GeoPoint;
  locations: StoreLocation[];
  driving: DrivingSettings;
  /** Minimum net savings (dollars) before we recommend a split trip. */
  splitThreshold: number;
  storeIds?: StoreId[];
}

function lineFor(item: GroceryItem, product: Product): PricedLine {
  return { item, product, storeId: product.storeId, cost: round2(product.price * item.quantity) };
}

function sum(lines: PricedLine[]): number {
  return round2(lines.reduce((acc, l) => acc + l.cost, 0));
}

function subsets<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 1; mask < 1 << items.length; mask++) {
    out.push(items.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

export function storeTotals(matches: ItemMatches[], storeIds: StoreId[]): StoreTotal[] {
  const comparable = matches.filter((m) => storeIds.some((s) => m.byStore[s]));
  const totals = storeIds.map((storeId) => {
    const lines: PricedLine[] = [];
    const missing: GroceryItem[] = [];
    for (const m of comparable) {
      const match = m.byStore[storeId];
      if (match) lines.push(lineFor(m.item, match.product));
      else missing.push(m.item);
    }
    return { storeId, total: sum(lines), lines, missing };
  });
  return totals.sort((a, b) => a.missing.length - b.missing.length || a.total - b.total);
}

/**
 * Cheapest way to buy every comparable item using only `storeIds`, or null if
 * those stores can't cover the list.
 */
function planFor(
  matches: ItemMatches[],
  storeIds: StoreId[],
  nearest: Partial<Record<StoreId, StoreLocation>>,
  opts: CompareOptions,
): TripPlan | null {
  const lines: PricedLine[] = [];
  for (const m of matches) {
    let best: Product | null = null;
    for (const s of storeIds) {
      const p = m.byStore[s]?.product;
      if (p && (!best || p.price < best.price)) best = p;
    }
    if (!best) return null;
    lines.push(lineFor(m.item, best));
  }

  // Drop stores that ended up with no items – they'd just add driving.
  const used = storeIds.filter((s) => lines.some((l) => l.storeId === s));
  if (used.length !== storeIds.length) return null;

  const stops = used.map((s) => nearest[s]).filter((l): l is StoreLocation => !!l);
  if (stops.length !== used.length) return null;
  const route = shortestRoundTrip(opts.home, stops);
  const cost = tripCost(route.miles, stops.length, opts.driving);
  const itemsTotal = sum(lines);
  return {
    storeIds: used,
    route: route.order,
    lines,
    itemsTotal,
    miles: cost.miles,
    fuelCost: cost.fuelCost,
    minutes: cost.minutes,
    timeCost: cost.timeCost,
    trueCost: itemsTotal + cost.fuelCost + cost.timeCost,
  };
}

export function analyzeSplit(single: TripPlan, split: TripPlan, threshold: number): SplitAnalysis {
  const savingsBeforeGas = round2(single.itemsTotal - split.itemsTotal);
  const extraFuelCost = round2(split.fuelCost - single.fuelCost);
  const extraTimeCost = round2(split.timeCost - single.timeCost);
  const netSavings = round2(savingsBeforeGas - extraFuelCost - extraTimeCost);
  return {
    plan: split,
    savingsBeforeGas,
    extraMiles: split.miles - single.miles,
    extraFuelCost,
    extraMinutes: split.minutes - single.minutes,
    extraTimeCost,
    netSavings,
    worthIt: netSavings >= threshold,
  };
}

export function compareList(items: GroceryItem[], products: Product[], opts: CompareOptions): Comparison {
  const storeIds = opts.storeIds ?? STORE_IDS;
  const matches = matchList(items, products, storeIds);
  const unmatched = matches.filter((m) => !storeIds.some((s) => m.byStore[s])).map((m) => m.item);
  const comparable = matches.filter((m) => storeIds.some((s) => m.byStore[s]));
  const nearest = nearestLocations(opts.home, opts.locations);

  const plans = subsets(storeIds)
    .map((combo) => planFor(comparable, combo, nearest, opts))
    .filter((p): p is TripPlan => p !== null);

  const singles = plans.filter((p) => p.storeIds.length === 1);
  const multis = plans.filter((p) => p.storeIds.length > 1);

  const bestSingle = minBy(singles, (p) => p.itemsTotal);
  const cheapestCombination = minBy(plans, (p) => p.itemsTotal + p.storeIds.length * 1e-6);
  const bestMulti = minBy(multis, (p) => p.trueCost);

  let bestSplit: SplitAnalysis | null = null;
  if (bestMulti && bestSingle) {
    bestSplit = analyzeSplit(bestSingle, bestMulti, opts.splitThreshold);
  } else if (bestMulti && !bestSingle) {
    // No single store has everything, so a split trip is the only complete option.
    bestSplit = {
      plan: bestMulti,
      savingsBeforeGas: 0,
      extraMiles: 0,
      extraFuelCost: 0,
      extraMinutes: 0,
      extraTimeCost: 0,
      netSavings: 0,
      worthIt: true,
    };
  }

  return {
    matches,
    storeTotals: storeTotals(matches, storeIds),
    unmatched,
    bestSingle,
    cheapestCombination,
    bestSplit,
  };
}

function minBy<T>(items: T[], key: (t: T) => number): T | null {
  let best: T | null = null;
  let bestKey = Infinity;
  for (const item of items) {
    const k = key(item);
    if (k < bestKey) {
      best = item;
      bestKey = k;
    }
  }
  return best;
}

export interface Substitution {
  item: GroceryItem;
  current: Product;
  alternative: Product;
  /** Savings for the item's full quantity. */
  savings: number;
}

/**
 * Smart substitutions: items on the list that are meaningfully cheaper at a
 * different store than the one the shopper plans to visit.
 */
export function substitutionsFor(matches: ItemMatches[], storeId: StoreId, minSavings = 0.25): Substitution[] {
  const out: Substitution[] = [];
  for (const m of matches) {
    const current = m.byStore[storeId]?.product;
    if (!current) continue;
    let alternative: Product | null = null;
    for (const match of Object.values(m.byStore)) {
      // Only suggest confident equivalents, not loose "closest" matches.
      if (match && match.score >= CONFIDENT_MATCH && match.product.price < (alternative ?? current).price) {
        alternative = match.product;
      }
    }
    if (!alternative) continue;
    const savings = round2((current.price - alternative.price) * m.item.quantity);
    if (savings >= minSavings) out.push({ item: m.item, current, alternative, savings });
  }
  return out.sort((a, b) => b.savings - a.savings);
}
