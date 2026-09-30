import { STORE_IDS } from './catalog';
import type { GroceryItem, ItemMatches, Product, ProductMatch, StoreId } from './types';

/** Below this score we treat the store as not carrying the item. */
export const MATCH_THRESHOLD = 0.34;
/** At or above this score the match is treated as the same product, not a substitute. */
export const CONFIDENT_MATCH = 0.8;

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'some', 'fresh', 'and', 'lb', 'lbs', 'oz', 'ct', 'pack', 'bag']);

function singularize(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith('oes')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t))
    .map(singularize);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

function containment(query: Set<string>, target: Set<string>): number {
  if (query.size === 0) return 0;
  let shared = 0;
  for (const t of query) if (target.has(t)) shared++;
  return shared / query.size;
}

/** How well `product` matches the free-text grocery item `query`, 0..1. */
export function scoreProduct(query: string, product: Product): number {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;

  let best = 0;
  product.keywords.forEach((keyword, i) => {
    const k = new Set(tokenize(keyword));
    let score = jaccard(q, k);
    // The first keyword is the product's canonical name – nudge it ahead of
    // secondary aliases so "bread" prefers sandwich bread over cuban bread.
    if (i === 0) score = Math.min(1, score + 0.02);
    best = Math.max(best, score);
  });

  // Fall back to the product title (brand names, variants) at a discount.
  const nameScore = containment(q, new Set(tokenize(product.name))) * 0.7;
  return Math.max(best, nameScore);
}

export function bestMatch(query: string, products: Product[]): ProductMatch | null {
  let winner: ProductMatch | null = null;
  for (const product of products) {
    const score = scoreProduct(query, product);
    if (score < MATCH_THRESHOLD) continue;
    if (!winner || score > winner.score || (score === winner.score && product.price < winner.product.price)) {
      winner = { product, score };
    }
  }
  return winner;
}

export function groupByStore(products: Product[]): Record<StoreId, Product[]> {
  const grouped = Object.fromEntries(STORE_IDS.map((id) => [id, [] as Product[]])) as Record<StoreId, Product[]>;
  for (const p of products) grouped[p.storeId]?.push(p);
  return grouped;
}

/** Find the closest product at every store for each grocery item. */
export function matchList(
  items: GroceryItem[],
  products: Product[],
  storeIds: StoreId[] = STORE_IDS,
): ItemMatches[] {
  const byStoreProducts = groupByStore(products);
  return items.map((item) => {
    const byStore = {} as Record<StoreId, ProductMatch | null>;
    for (const storeId of storeIds) byStore[storeId] = bestMatch(item.name, byStoreProducts[storeId] ?? []);
    return { item, byStore };
  });
}
