import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { productGroup, STORES, tokenize, type Product, type StoreId } from '@/core';
import { formatMoney, useStoreTextColor, useTheme } from '@/components/theme';
import { Button, Card, Field, Label, Row, Screen } from '@/components/ui';
import { useAppState } from '@/state/AppState';

interface Group {
  name: string;
  category: string;
  byStore: Partial<Record<StoreId, Product>>;
}

export default function PriceBookScreen() {
  const t = useTheme();
  const storeColor = useStoreTextColor();
  const { products, settings } = useAppState();
  const [query, setQuery] = useState('');
  const stores = settings.enabledStores;

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const p of products) {
      if (!stores.includes(p.storeId)) continue;
      const name = productGroup(p);
      const key = name.toLowerCase();
      const g = map.get(key) ?? { name, category: p.category, byStore: {} };
      // Keep the product you priced yourself if a store has two in a group.
      if (!g.byStore[p.storeId] || p.source === 'user') g.byStore[p.storeId] = p;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, stores]);

  const q = tokenize(query);
  const visible = q.length
    ? groups.filter((g) => {
        const hay = new Set(
          tokenize([g.name, g.category, ...Object.values(g.byStore).flatMap((p) => [p!.name, ...p!.keywords])].join(' ')),
        );
        return q.every((token) => [...hay].some((h) => h.startsWith(token)));
      })
    : groups;

  const shown = products.filter((p) => stores.includes(p.storeId));
  const mine = shown.filter((p) => p.source === 'user').length;

  return (
    <Screen>
      <Label variant="muted">
        Tap any price to update it with what you see in the store. {mine} of {shown.length} prices are yours; the rest
        are sample estimates.
      </Label>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="Search items" value={query} onChangeText={setQuery} autoCorrect={false} clearButtonMode="while-editing" />
        </View>
        <Button title="+ Item" kind="secondary" onPress={() => router.push('/price')} />
      </Row>

      {visible.length === 0 ? (
        <Card>
          <Label variant="muted">No items match “{query}”.</Label>
          <Button
            title={`Add “${query.trim()}” with a price`}
            onPress={() => router.push({ pathname: '/price', params: { name: query.trim() } })}
          />
        </Card>
      ) : null}

      {visible.map((g) => {
        const prices = stores.map((s) => g.byStore[s]?.price).filter((p): p is number => p !== undefined);
        const low = Math.min(...prices);
        return (
          <Card key={g.name} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                {g.name}
              </Label>
              <Label variant="small">{g.category}</Label>
            </Row>
            <Row style={{ alignItems: 'stretch' }}>
              {stores.map((s) => {
                const p = g.byStore[s];
                const cheapest = p && prices.length > 1 && p.price === low;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityLabel={p ? `${STORES[s].name} ${p.name} ${formatMoney(p.price)}` : `Add ${g.name} price at ${STORES[s].name}`}
                    onPress={() =>
                      router.push(
                        p
                          ? { pathname: '/price', params: { productId: p.id } }
                          : { pathname: '/price', params: { storeId: s, name: g.name } },
                      )
                    }
                    style={({ pressed }) => [
                      styles.cell,
                      { borderColor: cheapest ? t.primary : t.border, opacity: pressed ? 0.6 : 1 },
                      cheapest && { backgroundColor: t.highlight },
                    ]}>
                    <Label variant="small" numberOfLines={1} style={{ color: storeColor(s), fontWeight: '600' }}>
                      {STORES[s].name}
                    </Label>
                    <Label style={[styles.price, !p && { color: t.muted }]}>{p ? formatMoney(p.price) : '+ add'}</Label>
                    {p?.source === 'user' ? (
                      <Label variant="small" style={{ fontSize: 11 }}>
                        ✓ yours
                      </Label>
                    ) : p?.deal ? (
                      <Label variant="small" style={{ fontSize: 11 }} numberOfLines={1}>
                        {p.deal.kind === 'bogo' ? 'BOGO' : p.deal.label}
                      </Label>
                    ) : null}
                  </Pressable>
                );
              })}
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', gap: 2 },
  price: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
