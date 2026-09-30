// Runs when a lead is saved (called by the database trigger in 0002_messaging.sql).
// Alerts the owner (app notification / text / email), sends the instant reply, starts follow-ups.
// Deploy: supabase functions deploy on-new-lead --no-verify-jwt
import { json } from '../_shared/env.ts'
import { handleNewLead } from '../_shared/core.ts'
import { hookOk, liveDeps } from '../_shared/services.ts'

Deno.serve(async (req) => {
  if (!hookOk(req)) return json({ error: 'Unauthorized' }, 401)
  try {
    const { lead_id } = await req.json()
    return json(await handleNewLead(liveDeps(), lead_id))
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
