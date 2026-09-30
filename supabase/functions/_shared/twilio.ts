// Twilio: send SMS and verify that webhooks really come from Twilio.
import { env } from './env.ts'

export type SendSms = (to: string, from: string, body: string) => Promise<{ ok: boolean; sid?: string; error?: string }>

export const twilioConfigured = () => Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN'))

export function makeSendSms(f: typeof fetch = (...a) => fetch(...a)): SendSms {
  return async (to, from, body) => {
    const sid = env('TWILIO_ACCOUNT_SID'), token = env('TWILIO_AUTH_TOKEN')
    if (!sid || !token) return { ok: false, error: 'Texting is not set up (Twilio keys missing)' }
    if (!to || !from) return { ok: false, error: 'Missing phone number' }
    const params = new URLSearchParams({ To: to, From: from, Body: body })
    const statusUrl = env('FUNCTIONS_URL') ? `${env('FUNCTIONS_URL')}/twilio-status` : ''
    if (statusUrl) params.set('StatusCallback', statusUrl)
    const r = await f(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, error: data?.message || `Twilio error ${r.status}` }
    return { ok: true, sid: data.sid }
  }
}

/** Twilio signs each webhook: base64(HMAC-SHA1(authToken, url + sorted key/value pairs)). */
export async function validTwilioSignature(url: string, params: Record<string, string>, signature: string, token = env('TWILIO_AUTH_TOKEN')): Promise<boolean> {
  if (!token || !signature) return false
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return expected === signature
}

/** Reads a Twilio form-encoded webhook and checks its signature (skippable only for local testing). */
export async function readTwilioWebhook(req: Request, publicUrl: string): Promise<{ ok: boolean; params: Record<string, string> }> {
  const form = await req.formData()
  const params: Record<string, string> = {}
  form.forEach((v, k) => { params[k] = String(v) })
  if (env('TWILIO_SKIP_SIGNATURE') === 'true') return { ok: true, params }
  const ok = await validTwilioSignature(publicUrl, params, req.headers.get('x-twilio-signature') || '')
  return { ok, params }
}
