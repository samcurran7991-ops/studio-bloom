// Intake endpoint for leads that don't come through the studio page:
// Meta lead forms (via Zapier or Make), Instagram DMs/comments (via ManyChat), etc.
//
// Deploy:  supabase functions deploy ingest-lead --no-verify-jwt
//
// Call:    POST <FUNCTIONS_URL>/ingest-lead?studio=<slug>
//          Header  x-ingest-key: <the studio's key, shown in the dashboard under Connections>
//          Body    { "name": "Ana M.", "phone": "(555) 882-0193", "email": "...",
//                    "source": "meta-form" | "ig-dm" | "ig-comment" | "google",
//                    "campaign": "Lip Blush Lead Form", "message": "What is the price?" }
// The new-lead trigger then alerts the owner and sends the instant reply as usual.
import { json } from '../_shared/env.ts'
import { eq, makeDb } from '../_shared/db.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const slug = new URL(req.url).searchParams.get('studio') || ''
  const key = req.headers.get('x-ingest-key') || ''
  if (!slug || !key) return json({ error: 'Missing ?studio= or the x-ingest-key header' }, 400)

  const db = makeDb()
  const studio = await db.one('studios', `slug=${eq(slug)}&select=id,ingest_key`)
  if (!studio || studio.ingest_key !== key) return json({ error: 'Unauthorized' }, 401)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Body must be JSON' }, 400) }
  const phone = String(body.phone || body.phone_number || '').trim()
  if (!phone) return json({ error: 'phone is required' }, 400)

  const source = ['meta-form', 'meta-ad', 'ig-dm', 'ig-comment', 'google', 'ig-bio'].includes(body.source) ? body.source : 'meta-form'
  try {
    const id = await db.rpc('submit_lead', {
      p_slug: slug,
      p_lead: {
        kind: body.message ? 'question' : 'lead',
        name: String(body.name || body.full_name || 'New lead').slice(0, 80),
        phone,
        email: body.email ? String(body.email).slice(0, 120) : undefined,
        source,
        campaign: body.campaign ? String(body.campaign).slice(0, 120) : undefined,
        message: body.message ? String(body.message).slice(0, 2000) : undefined,
        quiz: {},
        assignedTo: 'desk',
      },
    })
    return json({ ok: true, lead_id: id })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 400)
  }
})
