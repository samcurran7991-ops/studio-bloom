// Daily: renews Instagram tokens before they expire. Called by pg_cron (see 0003_connections.sql).
// Deploy: supabase functions deploy refresh-tokens --no-verify-jwt
import { json } from '../_shared/env.ts'
import { refreshTokens } from '../_shared/connect.ts'
import { hookOk, liveDeps } from '../_shared/services.ts'

Deno.serve(async (req) => {
  if (!hookOk(req)) return json({ error: 'Unauthorized' }, 401)
  return json(await refreshTokens(liveDeps()))
})
