// The owner texts a lead from the dashboard. Requires the owner's login token.
// Deploy: supabase functions deploy send-sms
import { CORS, json } from '../_shared/env.ts'
import { ownerSend } from '../_shared/core.ts'
import { liveDeps, userFromRequest } from '../_shared/services.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const userId = await userFromRequest(req)
  if (!userId) return json({ ok: false, error: 'Please sign in again' }, 401, CORS)
  try {
    const { lead_id, body } = await req.json()
    const r = await ownerSend(liveDeps(), userId, String(lead_id || ''), String(body || ''))
    return json(r, 200, CORS) // errors are in r.error so the app can show them
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500, CORS)
  }
})
