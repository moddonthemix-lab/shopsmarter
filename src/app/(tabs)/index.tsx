import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { GroceryList } from '@/core';
import { useTheme } from '@/components/theme';
import { Badge, Button, Card, Field, Label, Row, Screen } from '@/components/ui';
import { parseNaturalLanguage } from '@/lib/ai';
import { useAppState } from '@/state/AppState';

function confirm(title: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title)) onConfirm();
    return;
  }
  Alert.alert(title, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function ListsScreen() {
  const { lists, createList, duplicateList, deleteList } = useAppState();
  const [prompt, setPrompt] = useState('');
  const [thinking, setThinking] = useState(false);

  const regular = lists.filter((l) => !l.isTemplate);
  const templates = lists.filter((l) => l.isTemplate);

  const newList = () => router.push(`/list/${createList('New list')}`);

  const buildFromPrompt = async () => {
    if (!prompt.trim()) return;
    setThinking(true);
    try {
      const { items } = await parseNaturalLanguage(prompt.trim());
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const id = createList(`Meal plan · ${date}`, items);
      setPrompt('');
      router.push(`/list/${id}`);
    } finally {
      setThinking(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Label variant="heading">What do you need this week?</Label>
        <Label variant="muted">Describe your meals and we&apos;ll build the list.</Label>
        <Field
          placeholder="Need food for tacos, breakfast, and snacks this week."
          value={prompt}
          onChangeText={setPrompt}
          onSubmitEditing={buildFromPrompt}
          returnKeyType="go"
        />
        <Button title="Build my list" onPress={buildFromPrompt} loading={thinking} disabled={!prompt.trim()} />
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <Label variant="title">My lists</Label>
        <Button title="+ New list" kind="secondary" onPress={newList} />
      </Row>
      {regular.length === 0 ? <Label variant="muted">No lists yet – create one or start from a template.</Label> : null}
      {regular.map((list) => (
        <ListRow
          key={list.id}
          list={list}
          onDuplicate={() => duplicateList(list.id)}
          onSaveTemplate={() => duplicateList(list.id, { asTemplate: true, title: list.title })}
          onDelete={() => confirm(`Delete “${list.title}”?`, () => deleteList(list.id))}
        />
      ))}

      <Label variant="title" style={{ marginTop: 12 }}>
        Templates
      </Label>
      {templates.length === 0 ? <Label variant="muted">Save any list as a template to reuse it every week.</Label> : null}
      {templates.map((list) => (
        <ListRow
          key={list.id}
          list={list}
          onUse={() => {
            const id = duplicateList(list.id);
            if (id) router.push(`/list/${id}`);
          }}
          onDelete={() => confirm(`Delete template “${list.title}”?`, () => deleteList(list.id))}
        />
      ))}
    </Screen>
  );
}

function ListRow({
  list,
  onDuplicate,
  onSaveTemplate,
  onUse,
  onDelete,
}: {
  list: GroceryList;
  onDuplicate?: () => void;
  onSaveTemplate?: () => void;
  onUse?: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const preview = list.items.map((i) => i.name).join(', ');
  return (
    <Card>
      <Pressable onPress={() => router.push(`/list/${list.id}`)} style={{ gap: 4 }}>
        <Row>
          <Label variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {list.title}
          </Label>
          {list.isTemplate ? <Badge text="Template" color={t.accent} /> : null}
        </Row>
        <Label variant="small" numberOfLines={2}>
          {list.items.length} items{preview ? ` · ${preview}` : ''}
        </Label>
      </Pressable>
      <View style={styles.actions}>
        {onUse ? <Button title="Use template" onPress={onUse} /> : null}
        {!list.isTemplate ? (
          <Button title="Compare" onPress={() => router.push(`/compare/${list.id}`)} disabled={!list.items.length} />
        ) : null}
        {onDuplicate ? <Button title="Duplicate" kind="ghost" onPress={onDuplicate} /> : null}
        {onSaveTemplate ? <Button title="Save as template" kind="ghost" onPress={onSaveTemplate} /> : null}
        <Button title="Delete" kind="ghost" onPress={onDelete} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
