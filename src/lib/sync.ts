import type { GroceryList } from '@/core';

import { supabase } from './supabase';

/**
 * Cloud sync for grocery lists. Lists are always saved locally first; when a
 * user is signed in they are mirrored to Supabase (RLS scopes rows per user).
 */

interface ListRow {
  id: string;
  title: string;
  is_template: boolean;
  updated_at: string;
  grocery_items: { id: string; item_name: string; quantity: number; position: number }[];
}

export async function pushList(userId: string, list: GroceryList): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('grocery_lists').upsert({
    id: list.id,
    user_id: userId,
    title: list.title,
    is_template: list.isTemplate,
    updated_at: list.updatedAt,
  });
  if (error) throw error;

  const { error: delError } = await supabase.from('grocery_items').delete().eq('list_id', list.id);
  if (delError) throw delError;
  if (list.items.length === 0) return;
  const { error: insError } = await supabase.from('grocery_items').insert(
    list.items.map((item, position) => ({
      id: item.id,
      list_id: list.id,
      item_name: item.name,
      quantity: item.quantity,
      position,
    })),
  );
  if (insError) throw insError;
}

export async function deleteRemoteList(listId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('grocery_lists').delete().eq('id', listId);
  if (error) throw error;
}

export async function pullLists(): Promise<GroceryList[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('id, title, is_template, updated_at, grocery_items(id, item_name, quantity, position)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as ListRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    isTemplate: row.is_template,
    updatedAt: row.updated_at,
    items: [...row.grocery_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, name: i.item_name, quantity: Number(i.quantity) })),
  }));
}

/** Newest version of each list wins. */
export function mergeLists(local: GroceryList[], remote: GroceryList[]): GroceryList[] {
  const byId = new Map(local.map((l) => [l.id, l]));
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
