// Receives Meta webhooks: lead-form submissions (Page "leadgen") and Instagram DMs + comments.
// Deploy: supabase functions deploy meta-webhook --no-verify-jwt
// Meta app → Webhooks: callback <FUNCTIONS_URL>/meta-webhook, verify token = META_VERIFY_TOKEN.
//   Page object: subscribe "leadgen".  Instagram object: subscribe "messages" and "comments".
import { json } from '../_shared/env.ts'
import { handleMetaWebhook, validMetaSignature } from '../_shared/connect.ts'
import { connectConfig, liveDeps } from '../_shared/services.ts'

Deno.serve(async (req) => {
  const c = connectConfig()
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams
    if (q.get('hub.mode') === 'subscribe' && c.metaVerifyToken && q.get('hub.verify_token') === c.metaVerifyToken) return new Response(q.get('hub.challenge') || '')
    return new Response('Forbidden', { status: 403 })
  }
  const raw = await req.text()
  if (!(await validMetaSignature(raw, req.headers.get('x-hub-signature-256'), [c.metaAppSecret, c.igAppSecret]))) return new Response('Bad signature', { status: 401 })
  let body: any
  try { body = JSON.parse(raw) } catch { return new Response('Bad JSON', { status: 400 }) }
  try {
    return json(await handleMetaWebhook(liveDeps(), body))
  } catch (e) {
    console.error('meta-webhook', e)
    return json({ ok: false }) // 200 so Meta doesn't disable the webhook; the error is in the function logs
  }
})
