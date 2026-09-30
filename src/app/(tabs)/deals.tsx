import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { activeDeals, STORES, type StoreId } from '@/core';
import { formatMoney, useStoreTextColor, useTheme } from '@/components/theme';
import { Badge, Button, Card, Label, Row, Screen } from '@/components/ui';
import { todayISO, useAppState } from '@/state/AppState';

const DEAL_HEADINGS: Record<StoreId, string> = {
  publix: 'Publix BOGOs',
  walmart: 'Walmart Rollbacks',
  aldi: 'Aldi Specials',
  winndixie: 'Winn-Dixie Promotions',
};

export default function DealsScreen() {
  const t = useTheme();
  const storeColor = useStoreTextColor();
  const { lists, addItems, products, priceHistory, settings } = useAppState();
  const enabled = settings.enabledStores;
  const [filter, setFilter] = useState<StoreId | 'all'>('all');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const today = todayISO();
  const deals = useMemo(() => activeDeals(products, today), [products, today]);

  // Prices you recorded that went down since the time before.
  const drops = useMemo(
    () =>
      products
        .filter((p) => enabled.includes(p.storeId))
        .map((p) => {
          const h = priceHistory[p.id] ?? [];
          const [prev, last] = h.slice(-2);
          return prev && last && last.price < prev.price ? { product: p, from: prev.price, to: last.price, date: last.date } : null;
        })
        .filter((d) => d !== null)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [products, priceHistory, enabled],
  );
  const target = lists.find((l) => !l.isTemplate);

  const addToList = (productId: string, name: string) => {
    if (!target) return;
    addItems(target.id, [{ name, quantity: 1 }]);
    setAdded(new Set(added).add(productId));
  };

  const stores = filter === 'all' ? enabled : [filter];
  const anyDeals = deals.some((d) => stores.includes(d.storeId));

  return (
    <Screen>
      {drops.length ? (
        <Card>
          <Label variant="heading">Price drops you’ve spotted</Label>
          {drops.map(({ product, from, to, date }) => (
            <Row key={product.id} style={{ justifyContent: 'space-between' }}>
              <Label variant="small" style={{ flex: 1 }} numberOfLines={1}>
                {STORES[product.storeId].name}: {product.name}
              </Label>
              <Label variant="small" style={{ color: t.primary, fontWeight: '700' }}>
                {formatMoney(from)} → {formatMoney(to)}
              </Label>
              <Label variant="small">{date.slice(5)}</Label>
            </Row>
          ))}
        </Card>
      ) : null}
      <Label variant="muted">Weekly specials (sample data – check the store’s weekly ad for current deals).</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        {(['all', ...enabled] as const).map((s) => {
          const active = filter === s;
          const color = s === 'all' ? t.primary : STORES[s].color;
          return (
            <Pressable
              key={s}
              onPress={() => setFilter(s)}
              style={[styles.chip, { borderColor: color }, active && { backgroundColor: color }]}>
              <Label variant="small" style={active ? { color: '#fff', fontWeight: '700' } : undefined}>
                {s === 'all' ? 'All stores' : STORES[s].name}
              </Label>
            </Pressable>
          );
        })}
      </Row>

      {stores.map((storeId) => {
        const storeDeals = deals.filter((d) => d.storeId === storeId);
        if (!storeDeals.length) return null;
        return (
          <Card key={storeId}>
            <Label variant="heading" style={{ color: storeColor(storeId) }}>
              {DEAL_HEADINGS[storeId]}
            </Label>
            {storeDeals.map((p) => (
              <View key={p.id} style={styles.deal}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Label>{p.name}</Label>
                  <Row>
                    <Badge text={p.deal!.label} color={t.accent} />
                    <Label variant="small">
                      {p.size} · thru {p.deal!.validThrough.slice(5)}
                    </Label>
                  </Row>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Label style={{ fontWeight: '700' }}>
                    {p.deal!.kind === 'bogo' ? `2 for ${formatMoney(p.regularPrice!)}` : formatMoney(p.price)}
                  </Label>
                  {p.regularPrice && p.deal!.kind !== 'bogo' ? (
                    <Label variant="small" style={{ textDecorationLine: 'line-through' }}>
                      {formatMoney(p.regularPrice)}
                    </Label>
                  ) : null}
                  {target ? (
                    <Button
                      title={added.has(p.id) ? 'Added' : '+ List'}
                      kind="ghost"
                      disabled={added.has(p.id)}
                      onPress={() => addToList(p.id, p.keywords[0].replace(/^./, (c) => c.toUpperCase()))}
                      style={{ minHeight: 28, paddingHorizontal: 0 }}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        );
      })}
      {!anyDeals ? (
        <Card>
          <Label variant="muted">No active deals right now. When you update a price that went down, it shows up here.</Label>
        </Card>
      ) : null}
      {target ? <Label variant="small">“+ List” adds the item to “{target.title}”.</Label> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  deal: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
});
