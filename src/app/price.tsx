import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SAMPLE_PRODUCTS, STORE_IDS, STORES, type StoreId } from '@/core';
import { formatMoney, useTheme } from '@/components/theme';
import { Button, Card, Field, Label, Row, Screen } from '@/components/ui';
import { useAppState } from '@/state/AppState';

function parsePrice(text: string): number | null {
  const n = Number(text.replace(/[^0-9.]/g, ''));
  return text.trim() && Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 100) / 100 : null;
}

/**
 * Set the price you actually see at the store.
 *   /price?productId=aldi:whole-milk          edit a known product
 *   /price?storeId=aldi&name=Cuban%20bread     add an item a store carries
 */
export default function PriceScreen() {
  const params = useLocalSearchParams<{ productId?: string; storeId?: string; name?: string }>();
  const { products, priceHistory, priceOverrides, setPrice, clearPrice, addCustomProduct, deleteCustomProduct } =
    useAppState();
  const t = useTheme();

  const product = params.productId ? products.find((p) => p.id === params.productId) : undefined;
  const isNew = !product;
  const storeParam = STORE_IDS.includes(params.storeId as StoreId) ? (params.storeId as StoreId) : undefined;

  const [storeId, setStoreId] = useState<StoreId>(product?.storeId ?? storeParam ?? 'walmart');
  const [name, setName] = useState(product?.name ?? params.name ?? '');
  const [size, setSize] = useState(product?.size ?? '');
  const [priceText, setPriceText] = useState(product ? product.price.toFixed(2) : '');
  const price = parsePrice(priceText);

  if (params.productId && !product) {
    return (
      <Screen>
        <Label variant="muted">That product no longer exists.</Label>
      </Screen>
    );
  }

  const isCustom = product?.id.includes(':custom-') ?? false;
  const sample = product ? SAMPLE_PRODUCTS.find((p) => p.id === product.id) : undefined;
  const history = product ? [...(priceHistory[product.id] ?? [])].reverse() : [];

  const save = () => {
    if (price === null) return;
    if (product) setPrice(product.id, price);
    else if (name.trim()) addCustomProduct(storeId, name, price, size.trim());
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Add a price' : 'Update price' }} />

      {isNew ? (
        <>
          <Label variant="small">Store</Label>
          <Row style={{ flexWrap: 'wrap' }}>
            {STORE_IDS.map((s) => (
              <Button
                key={s}
                title={STORES[s].name}
                kind={s === storeId ? 'primary' : 'secondary'}
                onPress={() => setStoreId(s)}
                style={{ minHeight: 36 }}
              />
            ))}
          </Row>
          <Field label="Item" value={name} onChangeText={setName} placeholder="e.g. Cuban bread" />
          <Field label="Size (optional)" value={size} onChangeText={setSize} placeholder="e.g. 1 loaf" />
        </>
      ) : (
        <Card>
          <Label variant="small">{STORES[product.storeId].name}</Label>
          <Label variant="heading">{product.name}</Label>
          {product.size ? <Label variant="muted">{product.size}</Label> : null}
          <Label variant="small">
            {product.source === 'user' ? `Your price from ${product.lastUpdated}` : `Sample price – not checked yet`}
          </Label>
        </Card>
      )}

      <Field
        label="Price per item ($)"
        value={priceText}
        onChangeText={setPriceText}
        keyboardType="decimal-pad"
        placeholder="0.00"
        autoFocus
        selectTextOnFocus
        onSubmitEditing={save}
        style={{ fontSize: 28, fontWeight: '700' }}
      />
      {priceText && price === null ? (
        <Label variant="small" style={{ color: t.danger }}>
          Enter a price like 3.49
        </Label>
      ) : null}
      <Label variant="small">
        For BOGO deals enter what one costs you (Publix rings a single BOGO item up at half price).
      </Label>

      <Button title="Save price" onPress={save} disabled={price === null || (isNew && !name.trim())} />

      {product && priceOverrides[product.id] && sample ? (
        <Button
          title={`Reset to sample price (${formatMoney(sample.price)})`}
          kind="ghost"
          onPress={() => {
            clearPrice(product.id);
            router.back();
          }}
        />
      ) : null}
      {product && isCustom ? (
        <Button
          title="Remove this item"
          kind="ghost"
          onPress={() => {
            deleteCustomProduct(product.id);
            router.back();
          }}
        />
      ) : null}

      {history.length ? (
        <Card>
          <Label variant="heading">Price history</Label>
          {history.map((h, i) => {
            const prev = history[i + 1];
            const diff = prev ? h.price - prev.price : 0;
            return (
              <Row key={h.date} style={{ justifyContent: 'space-between' }}>
                <Label variant="small">{h.date}</Label>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {diff ? (
                    <Label variant="small" style={{ color: diff > 0 ? t.danger : t.primary }}>
                      {diff > 0 ? '▲' : '▼'} {formatMoney(Math.abs(diff))}
                    </Label>
                  ) : null}
                  <Label style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(h.price)}</Label>
                </View>
              </Row>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
