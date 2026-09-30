import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  compareList,
  CONFIDENT_MATCH,
  SAMPLE_PRODUCTS,
  STORE_IDS,
  STORE_LOCATIONS,
  STORES,
  substitutionsFor,
  type PricedLine,
  type StoreId,
  type TripPlan,
} from '@/core';
import { formatMoney, useTheme } from '@/components/theme';
import { Badge, Button, Card, Divider, Label, Row, Screen } from '@/components/ui';
import { FREE_COMPARISONS_PER_MONTH, useAppState } from '@/state/AppState';

function StoreName({ id, bold }: { id: StoreId; bold?: boolean }) {
  return (
    <Row style={{ gap: 6 }}>
      <View style={[styles.dot, { backgroundColor: STORES[id].color }]} />
      <Label style={bold ? { fontWeight: '700' } : undefined}>{STORES[id].name}</Label>
    </Row>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Label variant={strong ? 'heading' : 'muted'}>{label}</Label>
      <Label variant={strong ? 'heading' : 'body'} style={styles.num}>
        {value}
      </Label>
    </Row>
  );
}

function minutes(n: number): string {
  return `${Math.round(n)} min`;
}

export default function CompareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getList, settings, consumeComparison, ready } = useAppState();
  const list = getList(id);
  const t = useTheme();

  // Charge one comparison per visit to this screen (free plan quota).
  const charged = useRef(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!ready || charged.current) return;
    charged.current = true;
    setAllowed(consumeComparison());
  }, [ready, consumeComparison]);

  const result = useMemo(
    () =>
      list
        ? compareList(list.items, SAMPLE_PRODUCTS, {
            home: settings.home,
            locations: STORE_LOCATIONS,
            driving: settings.driving,
            splitThreshold: settings.splitThreshold,
          })
        : null,
    [list, settings],
  );

  const [shopAt, setShopAt] = useState<StoreId | null>(null);
  const plannedStore = shopAt ?? result?.bestSingle?.storeIds[0] ?? result?.storeTotals[0]?.storeId ?? 'walmart';
  const subs = useMemo(
    () => (result ? substitutionsFor(result.matches, plannedStore) : []),
    [result, plannedStore],
  );

  if (!list || !result) {
    return (
      <Screen>
        <Label variant="muted">This list no longer exists.</Label>
      </Screen>
    );
  }

  if (allowed === false) {
    return (
      <Screen>
        <Card>
          <Label variant="heading">You&apos;ve used all {FREE_COMPARISONS_PER_MONTH} free comparisons this month</Label>
          <Label variant="muted">
            Upgrade to Pro ($4.99/month) for unlimited comparisons, price alerts, price history, family budgeting and
            receipt scanning.
          </Label>
          <Button title="See Pro plan" onPress={() => router.push('/settings')} />
        </Card>
      </Screen>
    );
  }

  const { storeTotals, bestSingle, bestSplit, cheapestCombination, unmatched, matches } = result;
  const cheapestId = bestSingle?.storeIds[0];
  const priciest = storeTotals.filter((s) => s.missing.length === 0).at(-1);

  return (
    <Screen>
      <Label variant="title">{list.title}</Label>

      {bestSingle ? (
        <Card style={{ backgroundColor: t.highlight, borderColor: t.primary }}>
          <Label variant="small">CHEAPEST SINGLE STORE</Label>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label variant="title">{STORES[bestSingle.storeIds[0]].name}</Label>
            <Label variant="title" style={styles.num}>
              {formatMoney(bestSingle.itemsTotal)}
            </Label>
          </Row>
          {priciest && priciest.storeId !== cheapestId ? (
            <Label variant="muted">
              Saves {formatMoney(priciest.total - bestSingle.itemsTotal)} vs. {STORES[priciest.storeId].name}
            </Label>
          ) : null}
          <Label variant="small">
            {bestSingle.miles.toFixed(1)} mi round trip · about {formatMoney(bestSingle.fuelCost)} in gas
          </Label>
        </Card>
      ) : (
        <Card style={{ backgroundColor: t.warning }}>
          <Label variant="heading">No single store carries everything</Label>
          <Label variant="muted">See the split trip below for the cheapest way to get it all.</Label>
        </Card>
      )}

      <Card>
        <Label variant="heading">Store totals</Label>
        {storeTotals.map((s) => (
          <View key={s.storeId}>
            <Row style={{ justifyContent: 'space-between' }}>
              <StoreName id={s.storeId} bold={s.storeId === cheapestId} />
              <Row>
                {s.storeId === cheapestId ? <Badge text="Cheapest" /> : null}
                <Label style={[styles.num, s.storeId === cheapestId && { fontWeight: '700' }]}>
                  {formatMoney(s.total)}
                </Label>
              </Row>
            </Row>
            {s.missing.length ? (
              <Label variant="small">Doesn&apos;t carry: {s.missing.map((i) => i.name).join(', ')}</Label>
            ) : null}
          </View>
        ))}
      </Card>

      {bestSplit ? <SplitCard analysis={bestSplit} hasSingle={!!bestSingle} threshold={settings.splitThreshold} /> : null}

      {cheapestCombination &&
      bestSplit &&
      cheapestCombination.storeIds.join() !== bestSplit.plan.storeIds.join() &&
      cheapestCombination.storeIds.length > 1 ? (
        <Card>
          <Label variant="heading">Absolute lowest grocery total</Label>
          <Label variant="muted">
            {cheapestCombination.storeIds.map((s) => STORES[s].name).join(' + ')}:{' '}
            {formatMoney(cheapestCombination.itemsTotal)} – but {cheapestCombination.miles.toFixed(1)} mi of driving
            eats the difference.
          </Label>
        </Card>
      ) : null}

      <Card>
        <Label variant="heading">Smart substitutions</Label>
        <Label variant="small">If you shop at…</Label>
        <Row style={{ flexWrap: 'wrap' }}>
          {STORE_IDS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setShopAt(s)}
              style={[
                styles.chip,
                { borderColor: STORES[s].color },
                plannedStore === s && { backgroundColor: STORES[s].color },
              ]}>
              <Label variant="small" style={plannedStore === s ? { color: '#fff', fontWeight: '700' } : undefined}>
                {STORES[s].name}
              </Label>
            </Pressable>
          ))}
        </Row>
        {subs.length === 0 ? (
          <Label variant="muted">Nothing on your list is meaningfully cheaper elsewhere. 🎉</Label>
        ) : (
          subs.map((sub) => (
            <View key={sub.item.id} style={{ gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Label style={{ flex: 1 }}>{sub.item.name}</Label>
                <Label style={[styles.num, { color: t.primary, fontWeight: '700' }]}>
                  save {formatMoney(sub.savings)}
                </Label>
              </Row>
              <Label variant="small">
                {sub.alternative.name} at {STORES[sub.alternative.storeId].name} ({formatMoney(sub.alternative.price)})
                instead of {formatMoney(sub.current.price)}
              </Label>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Label variant="heading">Product matches</Label>
        {matches.map((m) => (
          <View key={m.item.id} style={{ gap: 2 }}>
            <Divider />
            <Label style={{ fontWeight: '600' }}>
              {m.item.quantity > 1 ? `${m.item.quantity} × ` : ''}
              {m.item.name}
            </Label>
            {STORE_IDS.map((s) => {
              const match = m.byStore[s];
              return (
                <Row key={s} style={{ justifyContent: 'space-between' }}>
                  <Label variant="small" style={{ flex: 1 }} numberOfLines={1}>
                    {STORES[s].name}:{' '}
                    {match
                      ? `${match.product.name} ${match.product.size}${match.score < CONFIDENT_MATCH ? ' (closest match)' : ''}`
                      : 'not carried'}
                  </Label>
                  {match ? (
                    <Row style={{ gap: 4 }}>
                      {match.product.deal ? <Badge text={match.product.deal.label} color={t.accent} /> : null}
                      <Label variant="small" style={styles.num}>
                        {formatMoney(match.product.price)}
                      </Label>
                    </Row>
                  ) : null}
                </Row>
              );
            })}
          </View>
        ))}
      </Card>

      {unmatched.length ? (
        <Card style={{ backgroundColor: t.warning }}>
          <Label variant="heading">Couldn&apos;t find</Label>
          <Label variant="muted">
            {unmatched.map((i) => i.name).join(', ')} – try a more common name (e.g. “chicken breast”).
          </Label>
        </Card>
      ) : null}

      <Label variant="small" style={{ textAlign: 'center' }}>
        Prices are estimates and may vary by location. Driving costs use {settings.driving.mpg} MPG and{' '}
        {formatMoney(settings.driving.fuelPricePerGallon)}/gal from {settings.home.label}.
      </Label>
    </Screen>
  );
}

function SplitCard({
  analysis,
  hasSingle,
  threshold,
}: {
  analysis: NonNullable<ReturnType<typeof compareList>['bestSplit']>;
  hasSingle: boolean;
  threshold: number;
}) {
  const t = useTheme();
  const { plan } = analysis;
  const byStore = groupLines(plan);
  const verdictColor = analysis.worthIt ? t.primary : t.muted;

  return (
    <Card style={analysis.worthIt ? { borderColor: t.primary, borderWidth: 1.5 } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Label variant="heading">Split trip: {plan.storeIds.map((s) => STORES[s].name).join(' + ')}</Label>
        <Label variant="heading" style={styles.num}>
          {formatMoney(plan.itemsTotal)}
        </Label>
      </Row>
      <Label variant="small">Route: Home → {plan.route.map((r) => r.label).join(' → ')} → Home</Label>

      {plan.route.map((stop) => (
        <View key={stop.storeId} style={{ gap: 2 }}>
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <StoreName id={stop.storeId} bold />
            <Label style={styles.num}>{formatMoney(byStore[stop.storeId]?.reduce((a, l) => a + l.cost, 0) ?? 0)}</Label>
          </Row>
          {byStore[stop.storeId]?.map((line) => (
            <Row key={line.item.id} style={{ justifyContent: 'space-between' }}>
              <Label variant="small" style={{ flex: 1 }}>
                {line.item.name}
              </Label>
              <Label variant="small" style={styles.num}>
                {formatMoney(line.cost)}
              </Label>
            </Row>
          ))}
        </View>
      ))}

      {hasSingle ? (
        <>
          <Divider />
          <Stat label="Savings before gas" value={formatMoney(analysis.savingsBeforeGas)} />
          <Stat label={`Extra driving (${analysis.extraMiles.toFixed(1)} mi)`} value={`−${formatMoney(analysis.extraFuelCost)}`} />
          {analysis.extraTimeCost > 0 ? (
            <Stat label={`Extra time (${minutes(analysis.extraMinutes)})`} value={`−${formatMoney(analysis.extraTimeCost)}`} />
          ) : (
            <Stat label="Extra time" value={minutes(analysis.extraMinutes)} />
          )}
          <Stat label="Net savings" value={formatMoney(analysis.netSavings)} strong />
          <Label style={{ color: verdictColor, fontWeight: '600' }}>
            {analysis.worthIt
              ? '✅ Worth the extra stop.'
              : analysis.netSavings > 0
                ? `Only ${formatMoney(analysis.netSavings)} after gas – under your ${formatMoney(threshold)} minimum. Stick with one store.`
                : 'Not worth it – the drive costs more than you would save. Stick with one store.'}
          </Label>
        </>
      ) : (
        <Label variant="small">
          {plan.miles.toFixed(1)} mi · {formatMoney(plan.fuelCost)} gas · {minutes(plan.minutes)}
        </Label>
      )}
    </Card>
  );
}

function groupLines(plan: TripPlan): Partial<Record<StoreId, PricedLine[]>> {
  const out: Partial<Record<StoreId, PricedLine[]>> = {};
  for (const line of plan.lines) (out[line.storeId] ??= []).push(line);
  return out;
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5 },
  num: { fontVariant: ['tabular-nums'] },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
