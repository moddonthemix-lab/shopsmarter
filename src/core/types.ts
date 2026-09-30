export type StoreId = 'walmart' | 'aldi' | 'publix' | 'winndixie';

export interface Store {
  id: StoreId;
  name: string;
  /** Brand color used for badges in the UI. */
  color: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface StoreLocation extends GeoPoint {
  storeId: StoreId;
  label: string;
}

export type DealKind = 'bogo' | 'rollback' | 'special' | 'promo';

export interface Deal {
  kind: DealKind;
  label: string;
  /** ISO date (inclusive). */
  validThrough: string;
}

export interface Product {
  id: string;
  storeId: StoreId;
  name: string;
  size: string;
  category: string;
  /** Effective price per unit today (after any deal). */
  price: number;
  /** Shelf price before the deal, when a deal is active. */
  regularPrice?: number;
  deal?: Deal;
  /** Search terms that describe this product, e.g. ["milk", "whole milk"]. */
  keywords: string[];
  lastUpdated: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
}

export interface GroceryList {
  id: string;
  title: string;
  isTemplate: boolean;
  items: GroceryItem[];
  updatedAt: string;
}

export interface ProductMatch {
  product: Product;
  /** 0..1 confidence that the product is what the user meant. */
  score: number;
}

/** Best match for one grocery item at each store (null = not carried). */
export interface ItemMatches {
  item: GroceryItem;
  byStore: Record<StoreId, ProductMatch | null>;
}

export interface DrivingSettings {
  mpg: number;
  fuelPricePerGallon: number;
  /** Dollar value of the shopper's time per hour; 0 disables time cost. */
  hourlyTimeValue: number;
  /** Average driving speed used to estimate time, mph. */
  averageSpeedMph: number;
  /** Minutes spent per additional store stop (parking, checkout). */
  minutesPerStop: number;
}
