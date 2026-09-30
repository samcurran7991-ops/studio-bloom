// Instagram / Facebook / Google send the owner back here after they approve access.
// Deploy: supabase functions deploy connect-callback --no-verify-jwt
// Add <FUNCTIONS_URL>/connect-callback as the redirect URI in the Meta app (Facebook Login + Instagram) and Google OAuth client.
import { finishConnect } from '../_shared/connect.ts'
import { liveDeps } from '../_shared/services.ts'

Deno.serve(async (req) => {
  const q = Object.fromEntries(new URL(req.url).searchParams)
  const to = await finishConnect(liveDeps(), q)
  return new Response(null, { status: 302, headers: { Location: to } })
})
