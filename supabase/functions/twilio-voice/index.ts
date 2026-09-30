// Twilio "A call comes in" webhook: rings the owner's phone; if nobody answers, texts the caller back.
// Deploy: supabase functions deploy twilio-voice --no-verify-jwt
// Twilio console → Phone number → Voice → Webhook: <FUNCTIONS_URL>/twilio-voice (HTTP POST)
import { env, twiml, xmlEscape } from '../_shared/env.ts'
import { readTwilioWebhook } from '../_shared/twilio.ts'
import { handleMissedCall } from '../_shared/core.ts'
import { eq } from '../_shared/db.ts'
import { liveDeps } from '../_shared/services.ts'

Deno.serve(async (req) => {
  const step = new URL(req.url).searchParams.get('step') || 'start'
  const base = `${env('FUNCTIONS_URL')}/twilio-voice`
  const { ok, params } = await readTwilioWebhook(req, step === 'after' ? `${base}?step=after` : base)
  if (!ok) return new Response('Invalid signature', { status: 403 })
  const deps = liveDeps()

  if (step === 'start') {
    const studio = await deps.db.one('studios', `messaging->>twilioNumber=${eq(params.To)}&select=messaging`)
    const forward = studio?.messaging?.forwardTo
    if (forward) {
      return twiml(`<Dial timeout="20" callerId="${xmlEscape(params.To)}" action="${xmlEscape(base + '?step=after')}" method="POST"><Number>${xmlEscape(forward)}</Number></Dial>`)
    }
  }
  // Nobody answered (or no phone to ring): text them back.
  if (step === 'start' || !['completed', 'answered'].includes(params.DialCallStatus || '')) {
    const r = await handleMissedCall(deps, { from: params.From, to: params.To })
    const say = r.texted ? 'Sorry we missed your call. We have just sent you a text so we can help you right away.' : 'Sorry we missed your call. Please try again soon.'
    return twiml(`<Say voice="Polly.Joanna">${xmlEscape(say)}</Say><Hangup/>`)
  }
  return twiml('<Hangup/>')
})
