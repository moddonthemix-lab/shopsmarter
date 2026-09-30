import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { looksLikeNaturalLanguage, parseListText, type GroceryItem, type ParsedItem } from '@/core';
import { useTheme } from '@/components/theme';
import { Button, Card, Field, Label, Row, Screen } from '@/components/ui';
import { parseNaturalLanguage } from '@/lib/ai';
import { newId } from '@/lib/id';
import { useAppState } from '@/state/AppState';

export default function ListEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getList, updateList, comparisonsLeft } = useAppState();
  const list = getList(id);
  const t = useTheme();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  if (!list) {
    return (
      <Screen>
        <Label variant="muted">This list no longer exists.</Label>
      </Screen>
    );
  }

  const setItems = (items: GroceryItem[]) => updateList(list.id, { items });

  const addParsed = (parsed: ParsedItem[]) => {
    const items = list.items.map((i) => ({ ...i }));
    for (const p of parsed) {
      const existing = items.find((i) => i.name.toLowerCase() === p.name.toLowerCase());
      if (existing) existing.quantity += p.quantity;
      else items.push({ id: newId(), ...p });
    }
    setItems(items);
  };

  const addDraft = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    if (looksLikeNaturalLanguage(text)) {
      setBusy(true);
      try {
        addParsed((await parseNaturalLanguage(text)).items);
      } finally {
        setBusy(false);
      }
    } else {
      addParsed(parseListText(text));
    }
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) addParsed(parseListText(text));
  };

  const changeQty = (item: GroceryItem, delta: number) => {
    const quantity = Math.max(0, item.quantity + delta);
    setItems(
      quantity === 0
        ? list.items.filter((i) => i.id !== item.id)
        : list.items.map((i) => (i.id === item.id ? { ...i, quantity } : i)),
    );
  };

  const left = comparisonsLeft();

  return (
    <Screen>
      <Stack.Screen options={{ title: list.isTemplate ? 'Template' : 'Grocery List' }} />
      <Field
        label="List name"
        value={list.title}
        onChangeText={(title) => updateList(list.id, { title })}
        style={{ fontSize: 18, fontWeight: '600' }}
      />

      <Card>
        <Field
          placeholder="Add items: “2 milk”, “eggs, bread”, or “stuff for tacos”"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addDraft}
          returnKeyType="done"
          multiline
          blurOnSubmit
        />
        <Row>
          <Button title="Add" onPress={addDraft} loading={busy} disabled={!draft.trim()} style={{ flex: 1 }} />
          <Button title="Paste list" kind="secondary" onPress={pasteFromClipboard} style={{ flex: 1 }} />
        </Row>
        <Label variant="small">Tip: tap the microphone on your keyboard to dictate your list.</Label>
      </Card>

      {list.items.length === 0 ? <Label variant="muted">Your list is empty.</Label> : null}
      <Card style={{ paddingVertical: 4 }}>
        {list.items.map((item, idx) => (
          <View
            key={item.id}
            style={[styles.item, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
            <Label style={{ flex: 1 }}>{item.name}</Label>
            <Pressable accessibilityLabel={`Decrease ${item.name}`} onPress={() => changeQty(item, -1)} hitSlop={8}>
              <Label variant="heading" style={styles.qtyBtn}>
                −
              </Label>
            </Pressable>
            <Label style={styles.qty}>{item.quantity}</Label>
            <Pressable accessibilityLabel={`Increase ${item.name}`} onPress={() => changeQty(item, 1)} hitSlop={8}>
              <Label variant="heading" style={styles.qtyBtn}>
                +
              </Label>
            </Pressable>
          </View>
        ))}
      </Card>

      {list.isTemplate ? (
        <Label variant="small">Templates are starting points – use one from My Lists to make a copy you can compare.</Label>
      ) : (
        <>
          <Button
            title="Compare prices"
            onPress={() => router.push(`/compare/${list.id}`)}
            disabled={list.items.length === 0}
          />
          {Number.isFinite(left) ? (
            <Label variant="small" style={{ textAlign: 'center' }}>
              {left} of 10 free comparisons left this month
            </Label>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  qtyBtn: { width: 28, textAlign: 'center' },
  qty: { minWidth: 20, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
