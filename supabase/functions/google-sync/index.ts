// Google Business Profile tools for the owner: point the Website button at the studio page,
// and pull reviews + profile stats. Deploy: supabase functions deploy google-sync
import { CORS, json } from '../_shared/env.ts'
import { googleAction } from '../_shared/connect.ts'
import { liveDeps, userFromRequest } from '../_shared/services.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const userId = await userFromRequest(req)
  if (!userId) return json({ ok: false, error: 'Please sign in again' }, 200, CORS)
  try {
    const { studio_id, action, location } = await req.json()
    if (!['set-website', 'refresh'].includes(action)) return json({ ok: false, error: 'Unknown action' }, 200, CORS)
    return json(await googleAction(liveDeps(), userId, String(studio_id), action, location), 200, CORS)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200, CORS)
  }
})
