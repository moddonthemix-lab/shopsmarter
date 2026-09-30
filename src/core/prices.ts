import type { Product, StoreId } from './types';

/** A price you saw on the shelf or a receipt, replacing the sample price. */
export interface PriceOverride {
  price: number;
  /** ISO date the price was recorded. */
  updatedAt: string;
}

export interface PricePoint {
  price: number;
  date: string;
}

export interface PriceData {
  overrides: Record<string, PriceOverride>;
  /** Products you added that the sample catalog doesn't have. */
  custom: Product[];
}

/**
 * The catalog the app actually prices against: sample products with expired
 * deals reverted to shelf price, your own prices applied, and your own
 * products appended.
 */
export function resolveProducts(base: Product[], data: PriceData, today: string): Product[] {
  const resolved = base.map((p): Product => {
    const override = data.overrides[p.id];
    if (override) {
      return {
        ...p,
        price: override.price,
        regularPrice: undefined,
        deal: undefined,
        lastUpdated: override.updatedAt,
        source: 'user',
      };
    }
    if (p.deal && p.deal.validThrough < today) {
      return { ...p, price: p.regularPrice ?? p.price, regularPrice: undefined, deal: undefined, source: 'sample' };
    }
    return { ...p, source: 'sample' };
  });
  return [...resolved, ...data.custom.map((p) => ({ ...p, source: 'user' as const }))];
}

export function customProductId(storeId: StoreId, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${storeId}:custom-${slug}`;
}

/** Build a product for an item a store carries that isn't in the sample catalog. */
export function makeCustomProduct(
  storeId: StoreId,
  name: string,
  price: number,
  today: string,
  size = '',
): Product {
  const clean = name.trim();
  return {
    id: customProductId(storeId, clean),
    storeId,
    name: clean,
    size,
    category: 'My items',
    price,
    keywords: [clean.toLowerCase()],
    lastUpdated: today,
    source: 'user',
  };
}

/** Short label for the group a product belongs to in the price book. */
export function productGroup(p: Product): string {
  const k = p.keywords[0] ?? p.name;
  return k.charAt(0).toUpperCase() + k.slice(1);
}
