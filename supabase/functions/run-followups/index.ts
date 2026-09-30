// Sends follow-up texts that are due. Scheduled every 10 minutes with pg_cron (see 0002_messaging.sql).
// Deploy: supabase functions deploy run-followups --no-verify-jwt
import { json } from '../_shared/env.ts'
import { runFollowups } from '../_shared/core.ts'
import { hookOk, liveDeps } from '../_shared/services.ts'

Deno.serve(async (req) => {
  if (!hookOk(req)) return json({ error: 'Unauthorized' }, 401)
  try { return json(await runFollowups(liveDeps())) } catch (e) { return json({ ok: false, error: String(e) }, 500) }
})
