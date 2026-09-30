// Twilio delivery updates for sent texts (delivered / failed).
// Deploy: supabase functions deploy twilio-status --no-verify-jwt
import { env } from '../_shared/env.ts'
import { readTwilioWebhook } from '../_shared/twilio.ts'
import { eq, makeDb } from '../_shared/db.ts'

Deno.serve(async (req) => {
  const { ok, params } = await readTwilioWebhook(req, `${env('FUNCTIONS_URL')}/twilio-status`)
  if (!ok) return new Response('Invalid signature', { status: 403 })
  const s = params.MessageStatus
  const status = s === 'delivered' ? 'delivered' : ['failed', 'undelivered'].includes(s) ? 'failed' : null
  if (status && params.MessageSid) {
    await makeDb().update('messages', `provider_id=${eq(params.MessageSid)}`, { status, ...(status === 'failed' ? { error: params.ErrorCode ? `Carrier error ${params.ErrorCode}` : 'Not delivered' } : {}) })
  }
  return new Response('ok')
})
