import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { assignToStores, matchList, STORE_IDS, STORES, type GroceryItem, type StoreId } from '@/core';
import { formatMoney, useStoreTextColor, useTheme } from '@/components/theme';
import { Button, Card, Label, Row, Screen } from '@/components/ui';
import { useAppState } from '@/state/AppState';

/** In-store checklist for a plan: /shop/<listId>?stores=aldi,winndixie (in visiting order). */
export default function ShoppingScreen() {
  const { id, stores } = useLocalSearchParams<{ id: string; stores?: string }>();
  const { getList, updateList, products } = useAppState();
  const t = useTheme();
  const storeColor = useStoreTextColor();
  const list = getList(id);

  const storeIds = useMemo(() => {
    const parsed = (stores ?? '').split(',').filter((s): s is StoreId => STORE_IDS.includes(s as StoreId));
    return parsed.length ? parsed : STORE_IDS;
  }, [stores]);

  const plan = useMemo(
    () => (list ? assignToStores(matchList(list.items, products, storeIds), storeIds) : null),
    [list, products, storeIds],
  );

  if (!list || !plan) {
    return (
      <Screen>
        <Label variant="muted">This list no longer exists.</Label>
      </Screen>
    );
  }

  const toggle = (item: GroceryItem) =>
    updateList(list.id, { items: list.items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)) });
  const checkedCount = list.items.filter((i) => i.checked).length;
  const allLines = plan.stops.flatMap((s) => s.lines);
  const total = allLines.reduce((a, l) => a + l.cost, 0);
  const remaining = allLines.filter((l) => !l.item.checked).reduce((a, l) => a + l.cost, 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: storeIds.map((s) => STORES[s].name).join(' + ') }} />
      <Card style={{ backgroundColor: t.highlight, borderColor: t.primary }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label variant="heading">{list.title}</Label>
          <Label variant="heading" style={styles.num}>
            {formatMoney(total)}
          </Label>
        </Row>
        <Label variant="small">
          {checkedCount} of {list.items.length} in the cart · {formatMoney(remaining)} left to grab
        </Label>
      </Card>

      {plan.stops.map((stop, i) => (
        <Card key={stop.storeId} style={{ paddingVertical: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label variant="heading" style={{ color: storeColor(stop.storeId) }}>
              {plan.stops.length > 1 ? `Stop ${i + 1}: ` : ''}
              {STORES[stop.storeId].name}
            </Label>
            <Label style={styles.num}>{formatMoney(stop.subtotal)}</Label>
          </Row>
          {stop.lines.map((line) => (
            <Pressable
              key={line.item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!line.item.checked }}
              onPress={() => toggle(line.item)}
              style={[styles.line, { borderColor: t.border }]}>
              <View
                style={[
                  styles.box,
                  { borderColor: t.primary },
                  line.item.checked && { backgroundColor: t.primary },
                ]}>
                {line.item.checked ? <Label style={{ color: t.primaryText, fontWeight: '700' }}>✓</Label> : null}
              </View>
              <View style={{ flex: 1, opacity: line.item.checked ? 0.45 : 1 }}>
                <Label style={line.item.checked ? { textDecorationLine: 'line-through' } : undefined}>
                  {line.item.quantity > 1 ? `${line.item.quantity} × ` : ''}
                  {line.item.name}
                </Label>
                <Label variant="small" numberOfLines={1}>
                  {line.product.name}
                  {line.product.size ? ` · ${line.product.size}` : ''}
                </Label>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => router.push({ pathname: '/price', params: { productId: line.product.id } })}>
                <Label style={[styles.num, { textDecorationLine: 'underline' }]}>{formatMoney(line.cost)}</Label>
              </Pressable>
            </Pressable>
          ))}
        </Card>
      ))}

      {plan.unavailable.length ? (
        <Card style={{ backgroundColor: t.warning }}>
          <Label variant="heading">Not at these stores</Label>
          <Label variant="muted">{plan.unavailable.map((i) => i.name).join(', ')}</Label>
        </Card>
      ) : null}

      <Label variant="small" style={{ textAlign: 'center' }}>
        Tap a price to correct it – it’ll be used for every future comparison.
      </Label>
      {checkedCount ? (
        <Button
          title="Uncheck everything"
          kind="ghost"
          onPress={() => updateList(list.id, { items: list.items.map((i) => ({ ...i, checked: false })) })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  num: { fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
