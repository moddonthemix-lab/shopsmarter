import type { Deal, DealKind, Product, Store, StoreId, StoreLocation } from './types';

/**
 * Sample price catalog for the Tampa Bay area.
 *
 * Prices are illustrative seed data so the app works end to end without a
 * backend. In production these rows live in the Supabase `products` table and
 * are refreshed by the price-ingestion jobs and receipt scans.
 */

export const STORES: Record<StoreId, Store> = {
  walmart: { id: 'walmart', name: 'Walmart', color: '#0071CE' },
  aldi: { id: 'aldi', name: 'Aldi', color: '#00005F' },
  publix: { id: 'publix', name: 'Publix', color: '#3E8E41' },
  winndixie: { id: 'winndixie', name: 'Winn-Dixie', color: '#D62B1F' },
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];

export const STORE_LOCATIONS: StoreLocation[] = [
  { storeId: 'walmart', label: 'Walmart Supercenter – Dale Mabry', lat: 27.9936, lng: -82.5052 },
  { storeId: 'walmart', label: 'Walmart Supercenter – Brandon', lat: 27.9378, lng: -82.3265 },
  { storeId: 'aldi', label: 'Aldi – Kennedy Blvd', lat: 27.9447, lng: -82.4889 },
  { storeId: 'aldi', label: 'Aldi – Brandon', lat: 27.9322, lng: -82.3087 },
  { storeId: 'publix', label: 'Publix – South Tampa', lat: 27.9245, lng: -82.4989 },
  { storeId: 'publix', label: 'Publix – Seminole Heights', lat: 28.0036, lng: -82.4595 },
  { storeId: 'publix', label: 'Publix – Brandon', lat: 27.9407, lng: -82.2851 },
  { storeId: 'winndixie', label: 'Winn-Dixie – Hillsborough Ave', lat: 27.9967, lng: -82.4839 },
  { storeId: 'winndixie', label: 'Winn-Dixie – Brandon', lat: 27.9514, lng: -82.2948 },
];

/** Downtown Tampa – used when the user hasn't shared a location. */
export const DEFAULT_HOME = { lat: 27.9506, lng: -82.4572, label: 'Downtown Tampa' };

const PRICES_UPDATED = '2026-09-28';
const DEALS_VALID_THROUGH = '2026-10-06';

type DealSpec = { kind: DealKind; regular: number; label?: string };
type StoreEntry = [name: string, price: number, deal?: DealSpec];

interface CatalogItem {
  key: string;
  category: string;
  size: string;
  keywords: string[];
  stores: Partial<Record<StoreId, StoreEntry>>;
}

const DEFAULT_DEAL_LABELS: Record<DealKind, string> = {
  bogo: 'Buy 1 Get 1 Free',
  rollback: 'Rollback',
  special: 'Weekly Special',
  promo: 'Weekly Promo',
};

// prettier-ignore
const CATALOG: CatalogItem[] = [
  { key: 'whole-milk', category: 'Dairy', size: '1 gal', keywords: ['milk', 'whole milk', 'gallon of milk'], stores: {
    walmart: ['Great Value Whole Milk', 3.28], aldi: ['Friendly Farms Whole Milk', 3.05],
    publix: ['Publix Whole Milk', 4.59], winndixie: ['SE Grocers Whole Milk', 3.99] } },
  { key: 'eggs', category: 'Dairy', size: '12 ct', keywords: ['eggs', 'dozen eggs', 'large eggs', 'egg'], stores: {
    walmart: ['Great Value Large White Eggs', 2.97], aldi: ['Goldhen Large White Eggs', 2.49],
    publix: ['Publix Large White Eggs', 3.89], winndixie: ['SE Grocers Large Eggs', 3.49] } },
  { key: 'white-bread', category: 'Bakery', size: '20 oz', keywords: ['bread', 'white bread', 'sandwich bread', 'loaf'], stores: {
    walmart: ['Great Value White Sandwich Bread', 1.42], aldi: ['L\'oven Fresh White Bread', 1.39],
    publix: ['Publix White Sandwich Bread', 2.99, { kind: 'bogo', regular: 3.29 }], winndixie: ['SE Grocers White Bread', 2.29] } },
  { key: 'chicken-breast', category: 'Meat', size: 'per lb', keywords: ['chicken', 'chicken breast', 'boneless chicken', 'chicken breasts'], stores: {
    walmart: ['Boneless Skinless Chicken Breast', 2.47], aldi: ['Kirkwood Boneless Skinless Chicken Breast', 2.29],
    publix: ['Publix Boneless Skinless Chicken Breast', 4.49], winndixie: ['Boneless Skinless Chicken Breast', 1.99, { kind: 'promo', regular: 3.99, label: 'Digital Deal' }] } },
  { key: 'bananas', category: 'Produce', size: 'per lb', keywords: ['bananas', 'banana'], stores: {
    walmart: ['Fresh Bananas', 0.52], aldi: ['Bananas', 0.44], publix: ['Bananas', 0.69], winndixie: ['Bananas', 0.65] } },
  { key: 'white-rice', category: 'Pantry', size: '2 lb', keywords: ['rice', 'white rice', 'long grain rice'], stores: {
    walmart: ['Great Value Long Grain White Rice', 1.78], aldi: ['Earthly Grains Long Grain White Rice', 1.85],
    publix: ['Publix Long Grain Rice', 2.79], winndixie: ['SE Grocers Long Grain Rice', 2.49] } },
  { key: 'ground-beef', category: 'Meat', size: '1 lb', keywords: ['ground beef', 'hamburger meat', 'beef', 'hamburger'], stores: {
    walmart: ['80/20 Ground Beef', 4.84], aldi: ['80/20 Ground Beef', 4.49],
    publix: ['Publix 80/20 Ground Chuck', 5.99], winndixie: ['80/20 Ground Beef', 5.49] } },
  { key: 'flour-tortillas', category: 'Bakery', size: '10 ct', keywords: ['tortillas', 'flour tortillas', 'tortilla', 'taco shells'], stores: {
    walmart: ['Mission Flour Tortillas Soft Taco', 2.98], aldi: ['Pueblo Lindo Flour Tortillas', 1.95],
    publix: ['Mission Flour Tortillas Soft Taco', 4.19, { kind: 'bogo', regular: 4.19 }], winndixie: ['Mission Flour Tortillas Soft Taco', 3.79] } },
  { key: 'iceberg-lettuce', category: 'Produce', size: '1 head', keywords: ['lettuce', 'iceberg lettuce', 'salad'], stores: {
    walmart: ['Iceberg Lettuce', 1.48], aldi: ['Iceberg Lettuce', 1.29], publix: ['Iceberg Lettuce', 1.99], winndixie: ['Iceberg Lettuce', 1.79] } },
  { key: 'shredded-cheddar', category: 'Dairy', size: '8 oz', keywords: ['cheese', 'shredded cheese', 'cheddar', 'shredded cheddar'], stores: {
    walmart: ['Great Value Shredded Mild Cheddar', 2.14], aldi: ['Happy Farms Shredded Mild Cheddar', 1.99],
    publix: ['Publix Shredded Mild Cheddar', 3.49, { kind: 'bogo', regular: 3.49 }], winndixie: ['SE Grocers Shredded Cheddar', 2.79] } },
  { key: 'butter', category: 'Dairy', size: '16 oz', keywords: ['butter', 'salted butter', 'unsalted butter'], stores: {
    walmart: ['Great Value Salted Butter', 3.97], aldi: ['Countryside Creamery Salted Butter', 3.49],
    publix: ['Publix Salted Butter', 5.49], winndixie: ['SE Grocers Salted Butter', 4.79] } },
  { key: 'spaghetti', category: 'Pantry', size: '16 oz', keywords: ['pasta', 'spaghetti', 'noodles'], stores: {
    walmart: ['Great Value Spaghetti', 1.12], aldi: ['Reggano Spaghetti', 0.95],
    publix: ['Publix Spaghetti', 1.69], winndixie: ['SE Grocers Spaghetti', 1.39] } },
  { key: 'pasta-sauce', category: 'Pantry', size: '24 oz', keywords: ['pasta sauce', 'spaghetti sauce', 'marinara', 'tomato sauce'], stores: {
    walmart: ['Prego Traditional Italian Sauce', 2.34], aldi: ['Reggano Traditional Pasta Sauce', 1.65],
    publix: ['Prego Traditional Italian Sauce', 3.79, { kind: 'bogo', regular: 3.79 }], winndixie: ['Prego Traditional Italian Sauce', 3.29] } },
  { key: 'peanut-butter', category: 'Pantry', size: '16 oz', keywords: ['peanut butter', 'pb'], stores: {
    walmart: ['Great Value Creamy Peanut Butter', 1.98], aldi: ['Peanut Delight Creamy Peanut Butter', 1.89],
    publix: ['Jif Creamy Peanut Butter', 3.99], winndixie: ['SE Grocers Creamy Peanut Butter', 2.79] } },
  { key: 'cereal', category: 'Breakfast', size: '12 oz', keywords: ['cereal', 'breakfast cereal', 'cheerios', 'corn flakes'], stores: {
    walmart: ['Great Value Toasted Oats Cereal', 2.12], aldi: ['Millville Crispy Oats Cereal', 1.79],
    publix: ['Cheerios Original Cereal', 4.99, { kind: 'bogo', regular: 4.99 }], winndixie: ['Cheerios Original Cereal', 4.49] } },
  { key: 'orange-juice', category: 'Beverages', size: '52 oz', keywords: ['orange juice', 'oj', 'juice'], stores: {
    walmart: ['Tropicana Pure Premium Orange Juice', 3.98, { kind: 'rollback', regular: 4.48 }], aldi: ['Nature\'s Nectar Orange Juice', 2.95],
    publix: ['Florida\'s Natural Orange Juice', 4.99], winndixie: ['Florida\'s Natural Orange Juice', 4.49] } },
  { key: 'apples', category: 'Produce', size: '3 lb bag', keywords: ['apples', 'apple', 'gala apples'], stores: {
    walmart: ['Gala Apples 3 lb Bag', 3.97], aldi: ['Gala Apples 3 lb Bag', 3.49],
    publix: ['Gala Apples 3 lb Bag', 4.99], winndixie: ['Gala Apples 3 lb Bag', 4.49] } },
  { key: 'potatoes', category: 'Produce', size: '5 lb bag', keywords: ['potatoes', 'russet potatoes', 'potato'], stores: {
    walmart: ['Russet Potatoes 5 lb Bag', 2.97], aldi: ['Russet Potatoes 5 lb Bag', 2.79],
    publix: ['Russet Potatoes 5 lb Bag', 4.49], winndixie: ['Russet Potatoes 5 lb Bag', 3.99] } },
  { key: 'yellow-onions', category: 'Produce', size: '3 lb bag', keywords: ['onions', 'onion', 'yellow onions'], stores: {
    walmart: ['Yellow Onions 3 lb Bag', 2.64], aldi: ['Yellow Onions 3 lb Bag', 2.29],
    publix: ['Yellow Onions 3 lb Bag', 3.49], winndixie: ['Yellow Onions 3 lb Bag', 2.99] } },
  { key: 'tomatoes', category: 'Produce', size: 'per lb', keywords: ['tomatoes', 'tomato', 'roma tomatoes'], stores: {
    walmart: ['Roma Tomatoes', 1.12], aldi: ['Roma Tomatoes', 0.99], publix: ['Roma Tomatoes', 1.79], winndixie: ['Roma Tomatoes', 1.49] } },
  { key: 'tortilla-chips', category: 'Snacks', size: '13 oz', keywords: ['chips', 'tortilla chips', 'snacks'], stores: {
    walmart: ['Tostitos Restaurant Style Tortilla Chips', 3.98], aldi: ['Clancy\'s Restaurant Style Tortilla Chips', 1.99],
    publix: ['Tostitos Restaurant Style Tortilla Chips', 5.99, { kind: 'bogo', regular: 5.99 }], winndixie: ['Tostitos Restaurant Style Tortilla Chips', 3.50, { kind: 'promo', regular: 5.49 }] } },
  { key: 'salsa', category: 'Pantry', size: '16 oz', keywords: ['salsa', 'medium salsa'], stores: {
    walmart: ['Pace Medium Chunky Salsa', 2.68], aldi: ['Casa Mamita Medium Salsa', 1.89],
    publix: ['Pace Medium Chunky Salsa', 3.99], winndixie: ['Pace Medium Chunky Salsa', 3.49] } },
  { key: 'greek-yogurt', category: 'Dairy', size: '32 oz', keywords: ['yogurt', 'greek yogurt', 'plain yogurt'], stores: {
    walmart: ['Great Value Plain Greek Yogurt', 3.97], aldi: ['Friendly Farms Plain Greek Yogurt', 3.69],
    publix: ['Chobani Plain Greek Yogurt', 6.49], winndixie: ['Chobani Plain Greek Yogurt', 5.99] } },
  { key: 'ground-coffee', category: 'Beverages', size: '30.5 oz', keywords: ['coffee', 'ground coffee'], stores: {
    walmart: ['Folgers Classic Roast Ground Coffee', 11.98, { kind: 'rollback', regular: 13.48 }], aldi: ['Barissimo Classic Roast Ground Coffee', 8.99],
    publix: ['Folgers Classic Roast Ground Coffee', 14.99], winndixie: ['Folgers Classic Roast Ground Coffee', 13.99] } },
  { key: 'sugar', category: 'Pantry', size: '4 lb', keywords: ['sugar', 'granulated sugar'], stores: {
    walmart: ['Great Value Granulated Sugar', 3.12], aldi: ['Baker\'s Corner Granulated Sugar', 2.95],
    publix: ['Publix Granulated Sugar', 3.99], winndixie: ['SE Grocers Granulated Sugar', 3.69] } },
  { key: 'black-beans', category: 'Pantry', size: '15 oz can', keywords: ['black beans', 'beans', 'canned beans'], stores: {
    walmart: ['Great Value Black Beans', 0.78], aldi: ['Dakota\'s Pride Black Beans', 0.75],
    publix: ['Publix Black Beans', 1.25], winndixie: ['SE Grocers Black Beans', 0.99] } },
  { key: 'frozen-broccoli', category: 'Frozen', size: '12 oz', keywords: ['broccoli', 'frozen broccoli', 'frozen vegetables'], stores: {
    walmart: ['Great Value Broccoli Florets', 1.28], aldi: ['Season\'s Choice Broccoli Florets', 1.15],
    publix: ['Publix Broccoli Florets', 2.29], winndixie: ['SE Grocers Broccoli Florets', 1.79] } },
  { key: 'bacon', category: 'Meat', size: '12 oz', keywords: ['bacon', 'sliced bacon'], stores: {
    walmart: ['Great Value Hickory Smoked Bacon', 4.48], aldi: ['Appleton Farms Hickory Smoked Bacon', 3.99, { kind: 'special', regular: 4.49 }],
    publix: ['Oscar Mayer Naturally Hardwood Smoked Bacon', 7.49, { kind: 'bogo', regular: 7.49 }], winndixie: ['SE Grocers Hickory Smoked Bacon', 5.29] } },
  { key: 'oatmeal', category: 'Breakfast', size: '42 oz', keywords: ['oatmeal', 'oats', 'rolled oats', 'old fashioned oats'], stores: {
    walmart: ['Great Value Old Fashioned Oats', 3.48], aldi: ['Millville Old Fashioned Oats', 2.99],
    publix: ['Quaker Old Fashioned Oats', 5.99] } },
  { key: 'strawberries', category: 'Produce', size: '1 lb', keywords: ['strawberries', 'strawberry', 'berries'], stores: {
    walmart: ['Fresh Strawberries 1 lb', 2.97], aldi: ['Strawberries 1 lb', 1.99, { kind: 'special', regular: 2.69, label: 'Aldi Find' }],
    publix: ['Strawberries 1 lb', 3.99], winndixie: ['Strawberries 1 lb', 3.49] } },
  { key: 'deli-turkey', category: 'Deli', size: '9 oz', keywords: ['turkey', 'sliced turkey', 'deli turkey', 'lunch meat'], stores: {
    walmart: ['Great Value Oven Roasted Turkey Breast', 3.24], aldi: ['Lunch Mate Oven Roasted Turkey', 2.85],
    publix: ['Publix Deli Oven Roasted Turkey', 5.99], winndixie: ['SE Grocers Oven Roasted Turkey', 4.29] } },
  { key: 'frozen-pizza', category: 'Frozen', size: '1 pizza', keywords: ['pizza', 'frozen pizza'], stores: {
    walmart: ['DiGiorno Rising Crust Pepperoni Pizza', 5.98], publix: ['DiGiorno Rising Crust Pepperoni Pizza', 8.49, { kind: 'bogo', regular: 8.49 }],
    winndixie: ['DiGiorno Rising Crust Pepperoni Pizza', 6.99] } },
  { key: 'cuban-bread', category: 'Bakery', size: '1 loaf', keywords: ['cuban bread', 'french bread'], stores: {
    publix: ['Publix Bakery Cuban Bread', 2.49], winndixie: ['Winn-Dixie Bakery Cuban Bread', 1.99] } },
];

function buildDeal(spec: DealSpec): Deal {
  return {
    kind: spec.kind,
    label: spec.label ?? DEFAULT_DEAL_LABELS[spec.kind],
    validThrough: DEALS_VALID_THROUGH,
  };
}

function buildProducts(): Product[] {
  const products: Product[] = [];
  for (const item of CATALOG) {
    for (const storeId of STORE_IDS) {
      const entry = item.stores[storeId];
      if (!entry) continue;
      const [name, shelfPrice, dealSpec] = entry;
      // Publix rings up a single BOGO item at half price, so the effective
      // per-unit price is half the shelf price.
      const price = dealSpec?.kind === 'bogo' ? round2(shelfPrice / 2) : shelfPrice;
      products.push({
        id: `${storeId}:${item.key}`,
        storeId,
        name,
        size: item.size,
        category: item.category,
        price,
        regularPrice: dealSpec ? dealSpec.regular : undefined,
        deal: dealSpec ? buildDeal(dealSpec) : undefined,
        keywords: item.keywords,
        lastUpdated: PRICES_UPDATED,
      });
    }
  }
  return products;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const SAMPLE_PRODUCTS: Product[] = buildProducts();

/** Products with an active deal on `today` (ISO date). */
export function activeDeals(products: Product[], today: string): Product[] {
  return products.filter((p) => p.deal && p.deal.validThrough >= today);
}
