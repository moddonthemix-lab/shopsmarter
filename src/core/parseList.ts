export interface ParsedItem {
  name: string;
  quantity: number;
}

const QTY_PREFIX = /^(\d+(?:\.\d+)?)\s*(?:x|×)?\s+(.+)$/i;
const QTY_SUFFIX = /^(.+?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)$/i;
const QTY_PARENS = /^(.+?)\s*\((\d+(?:\.\d+)?)\)$/;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse one line like "2 milk", "eggs x3", "bread (2)" or "- Bananas". */
export function parseLine(raw: string): ParsedItem | null {
  const line = raw.replace(/^\s*(?:[-*•▢☐]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim();
  if (!line) return null;

  let name = line;
  let quantity = 1;
  const prefix = line.match(QTY_PREFIX);
  const suffix = line.match(QTY_SUFFIX);
  const parens = line.match(QTY_PARENS);
  if (prefix) {
    quantity = Number(prefix[1]);
    name = prefix[2];
  } else if (suffix) {
    name = suffix[1];
    quantity = Number(suffix[2]);
  } else if (parens) {
    name = parens[1];
    quantity = Number(parens[2]);
  }
  name = name.trim();
  if (!name || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { name: capitalize(name), quantity };
}

/** Parse a pasted list: one item per line, or comma-separated. */
export function parseListText(text: string): ParsedItem[] {
  const merged = new Map<string, ParsedItem>();
  for (const chunk of text.split(/[\n,;]+/)) {
    const parsed = parseLine(chunk);
    if (!parsed) continue;
    const key = parsed.name.toLowerCase();
    const existing = merged.get(key);
    if (existing) existing.quantity += parsed.quantity;
    else merged.set(key, parsed);
  }
  return [...merged.values()];
}

/**
 * Offline fallback for natural-language input ("food for tacos and
 * breakfast"). The `parse-grocery-list` edge function uses OpenAI for the
 * real thing; this keeps the feature usable without a backend.
 */
export const MEAL_IDEAS: Record<string, string[]> = {
  taco: ['Flour tortillas', 'Ground beef', 'Lettuce', 'Shredded cheddar', 'Tomatoes', 'Salsa'],
  breakfast: ['Eggs', 'Bacon', 'Bread', 'Butter', 'Orange juice', 'Bananas'],
  snack: ['Tortilla chips', 'Salsa', 'Apples', 'Greek yogurt', 'Peanut butter'],
  spaghetti: ['Spaghetti', 'Pasta sauce', 'Ground beef', 'Onions'],
  pasta: ['Spaghetti', 'Pasta sauce', 'Onions'],
  sandwich: ['Bread', 'Sliced turkey', 'Lettuce', 'Tomatoes', 'Shredded cheddar'],
  lunch: ['Bread', 'Sliced turkey', 'Lettuce', 'Apples'],
  'rice and beans': ['Rice', 'Black beans', 'Onions'],
  'chicken dinner': ['Chicken breast', 'Potatoes', 'Frozen broccoli', 'Butter'],
  pizza: ['Frozen pizza'],
  cuban: ['Cuban bread', 'Sliced turkey', 'Shredded cheddar'],
};

export function looksLikeNaturalLanguage(text: string): boolean {
  const t = text.toLowerCase();
  return !t.includes('\n') && /\b(need|want|food for|make|making|cook|meals?|week|this week)\b/.test(t);
}

export function expandMeals(text: string): ParsedItem[] {
  const t = text.toLowerCase();
  const names: string[] = [];
  for (const [meal, ingredients] of Object.entries(MEAL_IDEAS)) {
    if (new RegExp(`\\b${meal}s?\\b`).test(t)) names.push(...ingredients);
  }
  return parseListText(names.join('\n'));
}
