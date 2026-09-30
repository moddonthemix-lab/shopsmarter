import { describe, expect, it } from 'vitest';

import {
  activeDeals,
  compareList,
  DEFAULT_DRIVING,
  DEFAULT_HOME,
  expandMeals,
  looksLikeNaturalLanguage,
  matchList,
  parseLine,
  parseListText,
  SAMPLE_PRODUCTS,
  roadMiles,
  shortestRoundTrip,
  STORE_LOCATIONS,
  substitutionsFor,
  tripCost,
  type GroceryItem,
  type Product,
  type StoreLocation,
} from '../index';

const items = (...names: string[]): GroceryItem[] => names.map((name, i) => ({ id: String(i), name, quantity: 1 }));

function product(storeId: Product['storeId'], key: string, price: number, keywords: string[]): Product {
  return { id: `${storeId}:${key}`, storeId, name: key, size: '', category: '', price, keywords, lastUpdated: '2026-01-01' };
}

describe('parseListText', () => {
  it('parses quantities, bullets and merges duplicates', () => {
    expect(parseListText('- 2 milk\n* eggs x3\nbread (2)\n\nMilk, bananas')).toEqual([
      { name: 'Milk', quantity: 3 },
      { name: 'Eggs', quantity: 3 },
      { name: 'Bread', quantity: 2 },
      { name: 'Bananas', quantity: 1 },
    ]);
  });

  it('ignores blank and invalid lines', () => {
    expect(parseLine('   ')).toBeNull();
    expect(parseLine('0 milk')).toBeNull();
  });
});

describe('natural language fallback', () => {
  it('expands meals into ingredients', () => {
    const text = 'Need food for tacos, breakfast, and snacks this week.';
    expect(looksLikeNaturalLanguage(text)).toBe(true);
    const names = expandMeals(text).map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Flour tortillas', 'Ground beef', 'Eggs', 'Tortilla chips']));
    // Salsa appears in both tacos and snacks – merged, not duplicated.
    expect(names.filter((n) => n === 'Salsa')).toHaveLength(1);
  });

  it('does not treat a plain list as natural language', () => {
    expect(looksLikeNaturalLanguage('milk\neggs')).toBe(false);
  });
});

describe('matchList', () => {
  it('finds the closest product at each store', () => {
    const [milk] = matchList(items('Milk'), SAMPLE_PRODUCTS);
    expect(milk.byStore.walmart?.product.name).toBe('Great Value Whole Milk');
    expect(milk.byStore.aldi?.product.name).toBe('Friendly Farms Whole Milk');
    expect(milk.byStore.publix?.product.name).toBe('Publix Whole Milk');
    expect(milk.byStore.winndixie?.product.name).toBe('SE Grocers Whole Milk');
  });

  it('prefers the canonical product over partial matches', () => {
    const [bread, chicken, tortillas] = matchList(items('Bread', 'Chicken Breast', 'tortillas'), SAMPLE_PRODUCTS);
    expect(bread.byStore.publix?.product.id).toBe('publix:white-bread');
    expect(chicken.byStore.aldi?.product.id).toBe('aldi:chicken-breast');
    expect(tortillas.byStore.walmart?.product.id).toBe('walmart:flour-tortillas');
  });

  it('returns null where a store does not carry the item', () => {
    const [pizza, nonsense] = matchList(items('Frozen pizza', 'Xylophone'), SAMPLE_PRODUCTS);
    expect(pizza.byStore.aldi).toBeNull();
    expect(pizza.byStore.walmart).not.toBeNull();
    expect(Object.values(nonsense.byStore).every((m) => m === null)).toBe(true);
  });
});

describe('driving', () => {
  it('computes fuel and time cost', () => {
    const cost = tripCost(10, 1, { ...DEFAULT_DRIVING, mpg: 25, fuelPricePerGallon: 3, hourlyTimeValue: 20 });
    expect(cost.fuelCost).toBeCloseTo(1.2);
    expect(cost.minutes).toBeCloseTo(30); // 20 min driving + 10 min stop
    expect(cost.timeCost).toBeCloseTo(10);
  });

  it('finds the shortest visiting order', () => {
    const home = { lat: 0, lng: 0 };
    const a: StoreLocation = { storeId: 'aldi', label: 'a', lat: 0, lng: 0.1 };
    const b: StoreLocation = { storeId: 'walmart', label: 'b', lat: 0.1, lng: 0.1 };
    const c: StoreLocation = { storeId: 'publix', label: 'c', lat: 0.1, lng: 0 };
    // Going around the square beats criss-crossing it (a -> c -> b).
    const route = shortestRoundTrip(home, [a, c, b]);
    expect([['a', 'b', 'c'], ['c', 'b', 'a']]).toContainEqual(route.order.map((s) => s.label));
    expect(route.miles).toBeCloseTo(4 * roadMiles(home, a), 1);
  });
});

describe('compareList', () => {
  const opts = {
    home: DEFAULT_HOME,
    locations: STORE_LOCATIONS,
    driving: DEFAULT_DRIVING,
    splitThreshold: 3,
  };

  it('ranks stores and highlights the cheapest', () => {
    const result = compareList(items('Milk', 'Eggs', 'Bread', 'Chicken Breast', 'Bananas', 'Rice'), SAMPLE_PRODUCTS, opts);
    expect(result.storeTotals).toHaveLength(4);
    const totals = result.storeTotals.map((t) => t.total);
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
    expect(result.bestSingle?.storeIds).toEqual([result.storeTotals[0].storeId]);
    expect(result.cheapestCombination!.itemsTotal).toBeLessThanOrEqual(result.bestSingle!.itemsTotal);
  });

  it('recommends a split only when savings beat the drive', () => {
    // Two stores at the same spot: a split trip costs almost nothing extra.
    const locations: StoreLocation[] = [
      { storeId: 'aldi', label: 'A', lat: 28, lng: -82.5 },
      { storeId: 'walmart', label: 'W', lat: 28, lng: -82.5 },
    ];
    const products = [
      product('aldi', 'eggs', 2, ['eggs']),
      product('walmart', 'eggs', 6, ['eggs']),
      product('aldi', 'steak', 20, ['steak']),
      product('walmart', 'steak', 12, ['steak']),
    ];
    const base = { ...opts, home: { lat: 28.05, lng: -82.5 }, locations, storeIds: ['aldi', 'walmart'] as const };
    const close = compareList(items('eggs', 'steak'), products, { ...base, storeIds: [...base.storeIds] });
    expect(close.bestSingle?.itemsTotal).toBe(18); // walmart: 6 + 12
    expect(close.bestSplit?.savingsBeforeGas).toBe(4); // aldi eggs + walmart steak = 14
    expect(close.bestSplit?.worthIt).toBe(true);

    // Move Walmart 20 miles away – the split no longer pays for the gas.
    const farLocations = [locations[0], { ...locations[1], lat: 28.3 }];
    const far = compareList(items('eggs', 'steak'), products, {
      ...base,
      storeIds: [...base.storeIds],
      locations: farLocations,
      splitThreshold: 3,
    });
    expect(far.bestSplit!.extraFuelCost).toBeGreaterThan(0);
    expect(far.bestSplit!.netSavings).toBeLessThan(far.bestSplit!.savingsBeforeGas);
  });

  it('reports items no store carries and handles incomplete stores', () => {
    const result = compareList(items('Cuban bread', 'Frozen pizza', 'Xylophone'), SAMPLE_PRODUCTS, opts);
    expect(result.unmatched.map((i) => i.name)).toEqual(['Xylophone']);
    const aldi = result.storeTotals.find((t) => t.storeId === 'aldi')!;
    expect(aldi.missing.map((i) => i.name)).toEqual(['Frozen pizza']);
    // Aldi has no Cuban bread; its closest match is a low-confidence substitute.
    expect(result.matches[0].byStore.aldi!.score).toBeLessThan(0.8);
    expect(result.matches[0].byStore.publix!.score).toBe(1);
    // Only Publix and Winn-Dixie carry everything.
    expect(['publix', 'winndixie']).toContain(result.bestSingle?.storeIds[0]);
  });

  it('multiplies by quantity', () => {
    const one = compareList([{ id: '1', name: 'Eggs', quantity: 1 }], SAMPLE_PRODUCTS, opts);
    const three = compareList([{ id: '1', name: 'Eggs', quantity: 3 }], SAMPLE_PRODUCTS, opts);
    expect(three.bestSingle!.itemsTotal).toBeCloseTo(one.bestSingle!.itemsTotal * 3);
  });
});

describe('substitutionsFor', () => {
  it('suggests cheaper equivalents at other stores', () => {
    const matches = matchList(items('Milk', 'Cuban bread'), SAMPLE_PRODUCTS);
    const subs = substitutionsFor(matches, 'publix');
    const milk = subs.find((s) => s.item.name === 'Milk')!;
    expect(milk.alternative.storeId).toBe('aldi');
    expect(milk.savings).toBeCloseTo(4.59 - 3.05);
    expect(substitutionsFor(matches, 'aldi').find((s) => s.item.name === 'Milk')).toBeUndefined();
  });
});

describe('deals', () => {
  it('lists active deals and prices single Publix BOGO items at half', () => {
    const deals = activeDeals(SAMPLE_PRODUCTS, '2026-09-30');
    expect(deals.some((p) => p.deal?.kind === 'bogo')).toBe(true);
    expect(activeDeals(SAMPLE_PRODUCTS, '2026-12-01')).toHaveLength(0);
    const chips = SAMPLE_PRODUCTS.find((p) => p.id === 'publix:tortilla-chips')!;
    expect(chips.price).toBeCloseTo(chips.regularPrice! / 2);
  });
});
