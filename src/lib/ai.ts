import { expandMeals, parseListText, type ParsedItem } from '@/core';

import { supabase } from './supabase';

/**
 * Turn "Need food for tacos, breakfast, and snacks this week." into grocery
 * items. Uses the `parse-grocery-list` edge function (OpenAI) when a backend
 * is configured and falls back to the built-in meal dictionary otherwise.
 */
export async function parseNaturalLanguage(text: string): Promise<{ items: ParsedItem[]; source: 'ai' | 'offline' }> {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke<{ items: ParsedItem[] }>('parse-grocery-list', {
        body: { text },
      });
      if (!error && data?.items?.length) {
        const cleaned = parseListText(data.items.map((i) => `${i.quantity} ${i.name}`).join('\n'));
        return { items: cleaned, source: 'ai' };
      }
    } catch {
      // Fall through to the offline expansion.
    }
  }
  const expanded = expandMeals(text);
  return { items: expanded.length ? expanded : parseListText(text), source: 'offline' };
}
