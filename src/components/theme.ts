import { useColorScheme } from 'react-native';

import { STORES, type StoreId } from '@/core';

const light = {
  background: '#F6F7F4',
  card: '#FFFFFF',
  text: '#15201A',
  muted: '#5E6B63',
  border: '#DDE3DE',
  primary: '#1F8A4C',
  primaryText: '#FFFFFF',
  accent: '#F2A900',
  danger: '#C62828',
  highlight: '#E3F4E9',
  warning: '#FFF4D6',
};

const dark: typeof light = {
  background: '#0E1411',
  card: '#18211C',
  text: '#EAF0EC',
  muted: '#9AA8A0',
  border: '#2A362F',
  primary: '#3DBB72',
  primaryText: '#08130C',
  accent: '#F2B829',
  danger: '#EF6B6B',
  highlight: '#173424',
  warning: '#3A3113',
};

export type Palette = typeof light;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

// Brand colors are fine as fills, but some (Aldi navy) vanish as text on a dark background.
const DARK_STORE_TEXT: Record<StoreId, string> = {
  walmart: '#5AAEFF',
  aldi: '#8C9BFF',
  publix: '#6FCF74',
  winndixie: '#FF7A6E',
};

/** Returns a legible text color for a store in the current color scheme. */
export function useStoreTextColor(): (id: StoreId) => string {
  const dark = useColorScheme() === 'dark';
  return (id) => (dark ? DARK_STORE_TEXT[id] : STORES[id].color);
}
