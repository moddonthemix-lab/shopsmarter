import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { activeDeals, SAMPLE_PRODUCTS, STORE_IDS, STORES, type StoreId } from '@/core';
import { formatMoney, useTheme } from '@/components/theme';
import { Badge, Button, Card, Label, Row, Screen } from '@/components/ui';
import { newId } from '@/lib/id';
import { useAppState } from '@/state/AppState';

const DEAL_HEADINGS: Record<StoreId, string> = {
  publix: 'Publix BOGOs',
  walmart: 'Walmart Rollbacks',
  aldi: 'Aldi Specials',
  winndixie: 'Winn-Dixie Promotions',
};

export default function DealsScreen() {
  const t = useTheme();
  const { lists, updateList } = useAppState();
  const [filter, setFilter] = useState<StoreId | 'all'>('all');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().slice(0, 10);
  const deals = useMemo(() => activeDeals(SAMPLE_PRODUCTS, today), [today]);
  const target = lists.find((l) => !l.isTemplate);

  const addToList = (productId: string, name: string) => {
    if (!target) return;
    updateList(target.id, { items: [...target.items, { id: newId(), name, quantity: 1 }] });
    setAdded(new Set(added).add(productId));
  };

  const stores = filter === 'all' ? STORE_IDS : [filter];

  return (
    <Screen>
      <Label variant="muted">This week&apos;s deals across Tampa Bay stores.</Label>
      <Row style={{ flexWrap: 'wrap' }}>
        {(['all', ...STORE_IDS] as const).map((s) => {
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
            <Label variant="heading" style={{ color: STORES[storeId].color }}>
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
      {target ? <Label variant="small">“+ List” adds the item to “{target.title}”.</Label> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  deal: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
});
