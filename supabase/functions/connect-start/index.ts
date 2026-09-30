// The owner taps "Connect Instagram / Meta ads / Google". Returns the login URL to open.
// Deploy: supabase functions deploy connect-start
import { CORS, json } from '../_shared/env.ts'
import { startConnect, type Provider } from '../_shared/connect.ts'
import { liveDeps, userFromRequest } from '../_shared/services.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const userId = await userFromRequest(req)
  if (!userId) return json({ ok: false, error: 'Please sign in again' }, 200, CORS)
  try {
    const { studio_id, provider, return_to } = await req.json()
    return json(await startConnect(liveDeps(), userId, String(studio_id), provider as Provider, String(return_to || '/dashboard/connections')), 200, CORS)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200, CORS)
  }
})
