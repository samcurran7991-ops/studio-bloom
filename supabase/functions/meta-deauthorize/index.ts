// Meta calls this when an owner removes our app in Facebook/Instagram settings (deauthorize),
// or asks for their data to be deleted (?type=delete). Required for Meta app review.
// Deploy: supabase functions deploy meta-deauthorize --no-verify-jwt
// Meta app settings: Deauthorize callback = <FUNCTIONS_URL>/meta-deauthorize
//                    Data deletion callback = <FUNCTIONS_URL>/meta-deauthorize?type=delete
import { json } from '../_shared/env.ts'
import { handleDeauthorize, parseSignedRequest } from '../_shared/connect.ts'
import { connectConfig, liveDeps } from '../_shared/services.ts'

Deno.serve(async (req) => {
  const c = connectConfig()
  const form = await req.formData().catch(() => null)
  const data = await parseSignedRequest(String(form?.get('signed_request') || ''), [c.metaAppSecret, c.igAppSecret])
  if (!data?.user_id) return json({ error: 'Invalid request' }, 400)
  await handleDeauthorize(liveDeps(), String(data.user_id))
  if (new URL(req.url).searchParams.get('type') === 'delete') {
    const code = crypto.randomUUID()
    return json({ url: `${c.appUrl}/data-deletion?code=${code}`, confirmation_code: code })
  }
  return json({ ok: true })
})
