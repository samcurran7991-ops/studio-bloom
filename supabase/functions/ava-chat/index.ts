// Ava, the AI receptionist.
// Deploy:  supabase functions deploy ava-chat --no-verify-jwt
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (optional: AVA_MODEL)
//
// Returns { text } or { text: null }. On null the page falls back to the built-in
// rules, so the chat keeps working if this function or the AI provider is down.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { slug, history } = await req.json()
    if (typeof slug !== 'string' || !Array.isArray(history)) return json({ error: 'Bad request' }, 400)

    const key = Deno.env.get('ANTHROPIC_API_KEY')
    if (!key) return json({ text: null })

    // Load the studio's public info through the same function the page uses.
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/get_public_studio`, {
      method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    })
    const studio = await r.json()
    if (!studio?.config) return json({ error: 'Unknown studio' }, 404)
    const c = studio.config

    const info = {
      studio: c.name, city: c.city, address: c.address, hours: c.hours, phone: c.phone, instagram: c.instagram,
      artist: c.artist, deposit: c.deposit, reschedule: c.reschedule, bookingTool: c.bookingTool,
      services: c.services?.map((s: any) => ({ name: s.name, price: s.price, duration: s.duration, lasts: s.lasts, about: s.why })),
      faqs: c.faqs?.map((f: any) => ({ q: f.q, a: f.a })),
      whoToCall: c.team?.map((m: any) => ({ handles: m.role, name: m.name, hours: m.hours })),
    }

    const system = [
      `You are ${c.receptionistName}, the virtual receptionist for ${c.name}, a permanent makeup studio.`,
      'You are an automated assistant. If anyone asks, say so plainly.',
      'Answer ONLY from the STUDIO INFO below. Never invent prices, availability, discounts or policies.',
      `If the answer is not in the info, say you would rather not guess and offer to pass the question to ${c.artist?.name || 'the artist'} (usual reply time: ${c.replyTime}) or to call the right person.`,
      'Health questions (pregnancy, breastfeeding, allergies, skin conditions, medications, medical conditions): answer ONLY with the matching Health & safety FAQ text in the STUDIO INFO, never diagnose or add medical facts of your own, and always add that the artist confirms it at a free consult and that anyone under a doctor\'s care should check with their doctor. If no FAQ covers it, say the owner will answer personally and offer a callback.',
      'Encourage the visitor toward a next step: the 30-second match quiz, requesting a time, or the free 15-minute consult.',
      'Keep replies under 70 words. Warm, plain language. No emoji. No markdown.',
      '',
      'STUDIO INFO:',
      JSON.stringify(info),
    ].join('\n')

    // Convert the chat to the API's alternating user/assistant format.
    const msgs: { role: 'user' | 'assistant'; content: string }[] = []
    for (const t of history.slice(-12)) {
      const role = t?.from === 'visitor' ? 'user' : 'assistant'
      const content = String(t?.text ?? '').slice(0, 1000)
      if (!content) continue
      if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + content
      else msgs.push({ role, content })
    }
    while (msgs.length && msgs[0].role !== 'user') msgs.shift()
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ text: null })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: Deno.env.get('AVA_MODEL') || 'claude-haiku-4-5-20251001', max_tokens: 300, system, messages: msgs }),
    })
    if (!res.ok) return json({ text: null })
    const out = await res.json()
    const text = (out.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    return json({ text: text || null })
  } catch {
    return json({ text: null })
  }
})
