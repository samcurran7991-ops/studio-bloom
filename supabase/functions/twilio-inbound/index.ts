// Twilio "A message comes in" webhook for each studio number.
// Deploy: supabase functions deploy twilio-inbound --no-verify-jwt
// Twilio console → Phone number → Messaging → Webhook: <FUNCTIONS_URL>/twilio-inbound (HTTP POST)
import { env, twiml } from '../_shared/env.ts'
import { readTwilioWebhook } from '../_shared/twilio.ts'
import { handleInbound } from '../_shared/core.ts'
import { liveDeps } from '../_shared/services.ts'

Deno.serve(async (req) => {
  const { ok, params } = await readTwilioWebhook(req, `${env('FUNCTIONS_URL')}/twilio-inbound`)
  if (!ok) return new Response('Invalid signature', { status: 403 })
  await handleInbound(liveDeps(), { from: params.From, to: params.To, body: params.Body || '', sid: params.MessageSid })
  return twiml('') // no automatic reply; carrier handles STOP confirmations
})
