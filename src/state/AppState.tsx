import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_DRIVING, DEFAULT_HOME, type DrivingSettings, type GroceryItem, type GroceryList } from '@/core';
import { supabase } from '@/lib/supabase';
import { deleteRemoteList, mergeLists, pullLists, pushList } from '@/lib/sync';
import { newId } from '@/lib/id';

export const FREE_COMPARISONS_PER_MONTH = 10;

export type Plan = 'free' | 'pro';

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
  plan: Plan;
}

interface Usage {
  month: string;
  comparisons: number;
}

interface PersistedState {
  lists: GroceryList[];
  settings: Settings;
  usage: Usage;
}

const STORAGE_KEY = 'fgs/state/v1';

const DEFAULT_SETTINGS: Settings = {
  driving: DEFAULT_DRIVING,
  home: DEFAULT_HOME,
  splitThreshold: 3,
  plan: 'free',
};

const now = () => new Date().toISOString();
const currentMonth = () => now().slice(0, 7);

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
    usage: { month: currentMonth(), comparisons: 0 },
  };
}

interface AppStateValue extends PersistedState {
  ready: boolean;
  session: Session | null;
  getList: (id: string) => GroceryList | undefined;
  createList: (title: string, items?: Omit<GroceryItem, 'id'>[], isTemplate?: boolean) => string;
  updateList: (id: string, patch: Partial<Omit<GroceryList, 'id'>>) => void;
  deleteList: (id: string) => void;
  duplicateList: (id: string, opts?: { asTemplate?: boolean; title?: string }) => string | undefined;
  updateSettings: (patch: Partial<Settings>) => void;
  comparisonsLeft: () => number;
  /** Counts a comparison against the monthly quota; false if over the limit. */
  consumeComparison: () => boolean;
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const sync = useCallback((fn: (userId: string) => Promise<void>) => {
    const userId = sessionRef.current?.user.id;
    if (!userId) return;
    fn(userId).catch((e) => console.warn('Sync failed', e));
  }, []);

  // Load persisted state.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return commit(stateRef.current);
        const saved = JSON.parse(raw) as Partial<PersistedState>;
        commit({
          lists: saved.lists ?? [],
          settings: {
            ...DEFAULT_SETTINGS,
            ...saved.settings,
            driving: { ...DEFAULT_DRIVING, ...saved.settings?.driving },
          },
          usage: saved.usage ?? { month: currentMonth(), comparisons: 0 },
        });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [commit]);

  // Track auth and pull cloud lists on sign-in.
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
        items: newItems.map((i) => ({ ...i, id: newId() })),
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

  const comparisonsLeft = useCallback(() => {
    const s = stateRef.current;
    if (s.settings.plan === 'pro') return Infinity;
    const used = s.usage.month === currentMonth() ? s.usage.comparisons : 0;
    return Math.max(0, FREE_COMPARISONS_PER_MONTH - used);
  }, []);

  const consumeComparison = useCallback(() => {
    const s = stateRef.current;
    if (comparisonsLeft() <= 0) return false;
    const month = currentMonth();
    const used = s.usage.month === month ? s.usage.comparisons : 0;
    commit({ ...s, usage: { month, comparisons: used + 1 } });
    return true;
  }, [commit, comparisonsLeft]);

  const value = useMemo<AppStateValue>(
    () => ({
      ...state,
      ready,
      session,
      getList,
      createList,
      updateList,
      deleteList,
      duplicateList,
      updateSettings,
      comparisonsLeft,
      consumeComparison,
    }),
    [state, ready, session, getList, createList, updateList, deleteList, duplicateList, updateSettings, comparisonsLeft, consumeComparison],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
