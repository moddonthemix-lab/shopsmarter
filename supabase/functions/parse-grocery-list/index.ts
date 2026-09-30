// Supabase Edge Function (Deno): natural-language grocery input.
//
// POST { "text": "Need food for tacos, breakfast, and snacks this week." }
// → { "items": [{ "name": "Flour tortillas", "quantity": 1 }, ...] }
//
// Deploy:  supabase functions deploy parse-grocery-list
// Secret:  supabase secrets set OPENAI_API_KEY=sk-...

const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You turn a shopper's description into a grocery list for Florida supermarkets
(Walmart, Aldi, Publix, Winn-Dixie). Use short, generic product names a store would stock
("Ground beef", "Flour tortillas", "Eggs") – no brands. Merge duplicates. Quantities are store
units (packages, dozens, pounds). Respond with JSON: {"items":[{"name":string,"quantity":number}]}.
Return at most 40 items.`;

interface Item {
  name: string;
  quantity: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'OPENAI_API_KEY is not configured' }, 500);

  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
    return json({ error: '"text" must be a non-empty string under 2000 characters' }, 400);
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) return json({ error: `OpenAI request failed (${res.status})` }, 502);

  const completion = await res.json();
  let items: Item[] = [];
  try {
    const parsed = JSON.parse(completion.choices?.[0]?.message?.content ?? '{}');
    items = (Array.isArray(parsed.items) ? parsed.items : [])
      .filter((i: Partial<Item>) => typeof i?.name === 'string' && i.name.trim())
      .slice(0, 40)
      .map((i: Partial<Item>) => ({
        name: String(i.name).trim().slice(0, 60),
        quantity: Number.isFinite(i.quantity) && Number(i.quantity) > 0 ? Number(i.quantity) : 1,
      }));
  } catch {
    return json({ error: 'Could not parse model output' }, 502);
  }

  return json({ items });
});
