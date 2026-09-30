// Real outside services for the deployed functions: web push (VAPID) and email (Resend).
// Imported only by the function entry points, never by tests.
import webpush from 'npm:web-push@3.6.7'
import { env } from './env.ts'
import { makeDb } from './db.ts'
import { makeSendSms } from './twilio.ts'
import type { Deps, PushPayload } from './core.ts'
import type { ConnectConfig } from './connect.ts'

let vapidSet = false
async function push(subs: { endpoint: string; p256dh: string; auth: string }[], payload: PushPayload): Promise<string[]> {
  const pub = env('VAPID_PUBLIC_KEY'), priv = env('VAPID_PRIVATE_KEY')
  if (!pub || !priv) return []
  if (!vapidSet) { webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:support@example.com', pub, priv); vapidSet = true }
  const gone: string[] = []
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 })
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.endpoint) // device unsubscribed
    }
  }))
  return gone
}

async function email(to: string, subject: string, text: string): Promise<boolean> {
  const key = env('RESEND_API_KEY')
  if (!key) return false
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('ALERT_FROM_EMAIL') || 'Studio Alerts <alerts@resend.dev>', to: [to], subject, text }),
  })
  return r.ok
}

export function connectConfig(): ConnectConfig {
  return {
    functionsUrl: (env('FUNCTIONS_URL') || '').replace(/\/$/, ''),
    appUrl: (env('APP_URL') || '').replace(/\/$/, ''),
    metaAppId: env('META_APP_ID'), metaAppSecret: env('META_APP_SECRET'),
    // Instagram Login uses its own app id/secret (Meta app → Instagram → API setup). Falls back to the Meta app.
    igAppId: env('INSTAGRAM_APP_ID') || env('META_APP_ID'), igAppSecret: env('INSTAGRAM_APP_SECRET') || env('META_APP_SECRET'),
    metaVerifyToken: env('META_VERIFY_TOKEN'),
    googleClientId: env('GOOGLE_CLIENT_ID'), googleClientSecret: env('GOOGLE_CLIENT_SECRET'),
    graphVersion: env('META_GRAPH_VERSION') || 'v23.0',
  }
}

export function liveDeps(): Deps {
  return { db: makeDb(), sms: makeSendSms(), push, email, appUrl: (env('APP_URL') || '').replace(/\/$/, ''), http: (...a) => fetch(...a), cfg: connectConfig() }
}

/** Checks the caller's Supabase login token and returns their user id. */
export async function userFromRequest(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json()
  return u?.id || null
}

export const hookOk = (req: Request) => Boolean(env('HOOK_SECRET')) && req.headers.get('x-hook-secret') === env('HOOK_SECRET')
