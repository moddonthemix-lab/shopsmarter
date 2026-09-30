import type { DrivingSettings, GeoPoint, StoreId, StoreLocation } from './types';

/** Roads are longer than straight lines; typical urban circuity factor. */
export const ROAD_CIRCUITY = 1.3;

export const DEFAULT_DRIVING: DrivingSettings = {
  mpg: 25,
  fuelPricePerGallon: 3.29,
  hourlyTimeValue: 0,
  averageSpeedMph: 30,
  minutesPerStop: 10,
};

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

export function roadMiles(a: GeoPoint, b: GeoPoint): number {
  return haversineMiles(a, b) * ROAD_CIRCUITY;
}

/** Closest location of each chain to `home`. */
export function nearestLocations(home: GeoPoint, locations: StoreLocation[]): Partial<Record<StoreId, StoreLocation>> {
  const nearest: Partial<Record<StoreId, StoreLocation>> = {};
  for (const loc of locations) {
    const current = nearest[loc.storeId];
    if (!current || haversineMiles(home, loc) < haversineMiles(home, current)) nearest[loc.storeId] = loc;
  }
  return nearest;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

export interface Route {
  order: StoreLocation[];
  miles: number;
}

/**
 * Shortest round trip from home through every stop. With at most a handful of
 * stores, brute-forcing every visiting order is exact and cheap.
 */
export function shortestRoundTrip(home: GeoPoint, stops: StoreLocation[]): Route {
  if (stops.length === 0) return { order: [], miles: 0 };
  let best: Route | null = null;
  for (const order of permutations(stops)) {
    let miles = 0;
    let prev: GeoPoint = home;
    for (const stop of order) {
      miles += roadMiles(prev, stop);
      prev = stop;
    }
    miles += roadMiles(prev, home);
    if (!best || miles < best.miles) best = { order, miles };
  }
  return best!;
}

export interface TripCost {
  miles: number;
  fuelCost: number;
  minutes: number;
  timeCost: number;
}

export function tripCost(miles: number, stops: number, settings: DrivingSettings): TripCost {
  const fuelCost = settings.mpg > 0 ? (miles / settings.mpg) * settings.fuelPricePerGallon : 0;
  const driveMinutes = settings.averageSpeedMph > 0 ? (miles / settings.averageSpeedMph) * 60 : 0;
  const minutes = driveMinutes + stops * settings.minutesPerStop;
  const timeCost = (minutes / 60) * settings.hourlyTimeValue;
  return { miles, fuelCost, minutes, timeCost };
}
