import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  DEFAULT_DRIVING,
  DEFAULT_HOME,
  makeCustomProduct,
  resolveProducts,
  SAMPLE_PRODUCTS,
  STORE_IDS,
  type DrivingSettings,
  type GroceryItem,
  type GroceryList,
  type PriceOverride,
  type PricePoint,
  type Product,
  type StoreId,
} from '@/core';
import { newId } from '@/lib/id';
import { supabase } from '@/lib/supabase';
import { deleteRemoteList, mergeLists, pullLists, pushList } from '@/lib/sync';

export interface Home {
  lat: number;
  lng: number;
  label: string;
}

export interface Settings {
  driving: DrivingSettings;
  home: Home;
  /** Only recommend a split trip when it nets at least this many dollars. */
  splitThreshold: number;
  /** Stores you actually shop at. */
  enabledStores: StoreId[];
}

interface PersistedState {
  lists: GroceryList[];
  settings: Settings;
  priceOverrides: Record<string, PriceOverride>;
  customProducts: Product[];
  priceHistory: Record<string, PricePoint[]>;
}

const STORAGE_KEY = 'fgs/state/v1';

const DEFAULT_SETTINGS: Settings = {
  driving: DEFAULT_DRIVING,
  home: DEFAULT_HOME,
  splitThreshold: 3,
  enabledStores: STORE_IDS,
};

const now = () => new Date().toISOString();
/** Local calendar date (not UTC), so evening edits land on the right day. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function items(...names: string[]): GroceryItem[] {
  return names.map((name) => ({ id: newId(), name, quantity: 1 }));
}

function initialState(): PersistedState {
  return {
    lists: [
      {
        id: newId(),
        title: 'Weekly Staples',
        isTemplate: false,
        items: items('Milk', 'Eggs', 'Bread', 'Chicken Breast', 'Bananas', 'Rice'),
        updatedAt: now(),
      },
      {
        id: newId(),
        title: 'Taco Night',
        isTemplate: true,
        items: items('Flour tortillas', 'Ground beef', 'Lettuce', 'Shredded cheddar', 'Tomatoes', 'Salsa', 'Tortilla chips'),
        updatedAt: now(),
      },
    ],
    settings: DEFAULT_SETTINGS,
    priceOverrides: {},
    customProducts: [],
    priceHistory: {},
  };
}

/** Accepts saved data from any earlier version (or a backup) and fills gaps. */
function hydrate(saved: Partial<PersistedState>): PersistedState {
  const enabled = saved.settings?.enabledStores?.filter((s) => STORE_IDS.includes(s));
  return {
    lists: Array.isArray(saved.lists) ? saved.lists : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...saved.settings,
      driving: { ...DEFAULT_DRIVING, ...saved.settings?.driving },
      enabledStores: enabled?.length ? enabled : STORE_IDS,
    },
    priceOverrides: saved.priceOverrides ?? {},
    customProducts: saved.customProducts ?? [],
    priceHistory: saved.priceHistory ?? {},
  };
}

/** Append today's price to a product's history (one entry per day, last 50 kept). */
function withHistory(s: PersistedState, productId: string, price: number): Record<string, PricePoint[]> {
  const date = todayISO();
  const past = (s.priceHistory[productId] ?? []).filter((p) => p.date !== date);
  return { ...s.priceHistory, [productId]: [...past, { price, date }].slice(-50) };
}

interface AppStateValue extends PersistedState {
  session: Session | null;
  /** Catalog with your prices applied – use this for all pricing. */
  products: Product[];
  getList: (id: string) => GroceryList | undefined;
  createList: (title: string, items?: Omit<GroceryItem, 'id'>[], isTemplate?: boolean) => string;
  updateList: (id: string, patch: Partial<Omit<GroceryList, 'id'>>) => void;
  deleteList: (id: string) => void;
  duplicateList: (id: string, opts?: { asTemplate?: boolean; title?: string }) => string | undefined;
  /** Add items to a list, merging quantities of items already on it. */
  addItems: (listId: string, items: Omit<GroceryItem, 'id'>[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Record the price you paid/saw for a catalog product. */
  setPrice: (productId: string, price: number) => void;
  /** Go back to the sample price for a catalog product. */
  clearPrice: (productId: string) => void;
  /** Add (or re-price) a product a store carries that isn't in the catalog. Returns its id. */
  addCustomProduct: (storeId: StoreId, name: string, price: number, size?: string) => string;
  deleteCustomProduct: (productId: string) => void;
  exportData: () => string;
  importData: (json: string) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const stateRef = useRef(state);
  const sessionRef = useRef<Session | null>(null);

  const commit = useCallback((next: PersistedState) => {
    stateRef.current = next;
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) => console.warn('Save failed', e));
  }, []);

  const sync = useCallback((fn: (userId: string) => Promise<void>) => {
    const userId = sessionRef.current?.user.id;
    if (!userId) return;
    fn(userId).catch((e) => console.warn('Sync failed', e));
  }, []);

  // Load persisted state before rendering anything, so nothing can overwrite it.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => commit(raw ? hydrate(JSON.parse(raw)) : stateRef.current))
      .catch((e) => console.warn('Load failed', e))
      .finally(() => setReady(true));
  }, [commit]);

  // Optional cloud sync: track auth and pull lists on sign-in.
  useEffect(() => {
    if (!supabase) return;
    const onSession = (next: Session | null) => {
      const signedIn = !sessionRef.current && next;
      sessionRef.current = next;
      setSession(next);
      if (!signedIn) return;
      pullLists()
        .then((remote) => {
          const merged = mergeLists(stateRef.current.lists, remote);
          commit({ ...stateRef.current, lists: merged });
          // Upload local-only lists created before signing in.
          const remoteIds = new Set(remote.map((r) => r.id));
          for (const l of merged) if (!remoteIds.has(l.id)) sync((uid) => pushList(uid, l));
        })
        .catch((e) => console.warn('Pull failed', e));
    };
    supabase.auth.getSession().then(({ data }) => onSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => onSession(next));
    return () => data.subscription.unsubscribe();
  }, [commit, sync]);

  // Debounce uploads so typing in a list title doesn't hit the network per keystroke.
  const pushTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const schedulePush = useCallback(
    (list: GroceryList) => {
      if (!sessionRef.current) return;
      const timers = pushTimers.current;
      clearTimeout(timers.get(list.id));
      timers.set(
        list.id,
        setTimeout(() => {
          timers.delete(list.id);
          sync((uid) => pushList(uid, list));
        }, 800),
      );
    },
    [sync],
  );

  const getList = useCallback((id: string) => state.lists.find((l) => l.id === id), [state.lists]);

  const saveList = useCallback(
    (list: GroceryList) => {
      const s = stateRef.current;
      const exists = s.lists.some((l) => l.id === list.id);
      const lists = exists ? s.lists.map((l) => (l.id === list.id ? list : l)) : [list, ...s.lists];
      commit({ ...s, lists });
      schedulePush(list);
    },
    [commit, schedulePush],
  );

  const createList = useCallback<AppStateValue['createList']>(
    (title, newItems = [], isTemplate = false) => {
      const list: GroceryList = {
        id: newId(),
        title,
        isTemplate,
        items: newItems.map((i) => ({ name: i.name, quantity: i.quantity, id: newId() })),
        updatedAt: now(),
      };
      saveList(list);
      return list.id;
    },
    [saveList],
  );

  const updateList = useCallback<AppStateValue['updateList']>(
    (id, patch) => {
      const list = stateRef.current.lists.find((l) => l.id === id);
      if (list) saveList({ ...list, ...patch, updatedAt: now() });
    },
    [saveList],
  );

  const addItems = useCallback<AppStateValue['addItems']>(
    (listId, incoming) => {
      const list = stateRef.current.lists.find((l) => l.id === listId);
      if (!list) return;
      const next = list.items.map((i) => ({ ...i }));
      for (const p of incoming) {
        const existing = next.find((i) => i.name.toLowerCase() === p.name.toLowerCase());
        if (existing) existing.quantity += p.quantity;
        else next.push({ id: newId(), name: p.name, quantity: p.quantity });
      }
      saveList({ ...list, items: next, updatedAt: now() });
    },
    [saveList],
  );

  const deleteList = useCallback(
    (id: string) => {
      const s = stateRef.current;
      commit({ ...s, lists: s.lists.filter((l) => l.id !== id) });
      clearTimeout(pushTimers.current.get(id));
      pushTimers.current.delete(id);
      sync(() => deleteRemoteList(id));
    },
    [commit, sync],
  );

  const duplicateList = useCallback<AppStateValue['duplicateList']>(
    (id, opts = {}) => {
      const source = stateRef.current.lists.find((l) => l.id === id);
      if (!source) return undefined;
      const asTemplate = opts.asTemplate ?? false;
      const title = opts.title ?? (source.isTemplate && !asTemplate ? source.title : `${source.title} (copy)`);
      return createList(title, source.items, asTemplate);
    },
    [createList],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const s = stateRef.current;
      commit({ ...s, settings: { ...s.settings, ...patch } });
    },
    [commit],
  );

  const setPrice = useCallback(
    (productId: string, price: number) => {
      const s = stateRef.current;
      if (s.customProducts.some((p) => p.id === productId)) {
        commit({
          ...s,
          customProducts: s.customProducts.map((p) =>
            p.id === productId ? { ...p, price, lastUpdated: todayISO() } : p,
          ),
          priceHistory: withHistory(s, productId, price),
        });
        return;
      }
      commit({
        ...s,
        priceOverrides: { ...s.priceOverrides, [productId]: { price, updatedAt: todayISO() } },
        priceHistory: withHistory(s, productId, price),
      });
    },
    [commit],
  );

  const clearPrice = useCallback(
    (productId: string) => {
      const s = stateRef.current;
      const { [productId]: _removed, ...rest } = s.priceOverrides;
      commit({ ...s, priceOverrides: rest });
    },
    [commit],
  );

  const addCustomProduct = useCallback<AppStateValue['addCustomProduct']>(
    (storeId, name, price, size = '') => {
      const s = stateRef.current;
      const product = makeCustomProduct(storeId, name, price, todayISO(), size);
      commit({
        ...s,
        customProducts: [...s.customProducts.filter((p) => p.id !== product.id), product],
        priceHistory: withHistory(s, product.id, price),
      });
      return product.id;
    },
    [commit],
  );

  const deleteCustomProduct = useCallback(
    (productId: string) => {
      const s = stateRef.current;
      const { [productId]: _removed, ...history } = s.priceHistory;
      commit({ ...s, customProducts: s.customProducts.filter((p) => p.id !== productId), priceHistory: history });
    },
    [commit],
  );

  const exportData = useCallback(() => JSON.stringify({ app: 'florida-grocery-saver', version: 1, ...stateRef.current }), []);

  const importData = useCallback(
    (json: string) => {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.lists)) {
        throw new Error('That doesn’t look like a Grocery Saver backup.');
      }
      commit(hydrate(parsed));
    },
    [commit],
  );

  const today = todayISO();
  const products = useMemo(
    () => resolveProducts(SAMPLE_PRODUCTS, { overrides: state.priceOverrides, custom: state.customProducts }, today),
    [state.priceOverrides, state.customProducts, today],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      ...state,
      session,
      products,
      getList,
      createList,
      updateList,
      deleteList,
      duplicateList,
      addItems,
      updateSettings,
      setPrice,
      clearPrice,
      addCustomProduct,
      deleteCustomProduct,
      exportData,
      importData,
    }),
    [
      state,
      session,
      products,
      getList,
      createList,
      updateList,
      deleteList,
      duplicateList,
      addItems,
      updateSettings,
      setPrice,
      clearPrice,
      addCustomProduct,
      deleteCustomProduct,
      exportData,
      importData,
    ],
  );

  if (!ready) return null;
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
