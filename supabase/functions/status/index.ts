// Tells the dashboard which services are switched on (no secrets are returned).
// Deploy: supabase functions deploy status --no-verify-jwt
import { CORS, env, json } from '../_shared/env.ts'
import { configured } from '../_shared/connect.ts'
import { connectConfig } from '../_shared/services.ts'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  return json({
    texting: Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN')),
    email: Boolean(env('RESEND_API_KEY')),
    ai: Boolean(env('ANTHROPIC_API_KEY')),
    push: Boolean(env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY')),
    vapidPublicKey: env('VAPID_PUBLIC_KEY') || null,
    alertsHook: Boolean(env('HOOK_SECRET')),
    functionsUrl: env('FUNCTIONS_URL') || null,
    connect: configured(connectConfig()), // which one-tap connections are set up on the server
  }, 200, CORS)
})
