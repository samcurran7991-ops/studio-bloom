// Reads a secret/env var in Deno (Supabase) or Node/Bun (tests).
export function env(key: string): string {
  const g = globalThis as any
  return (g.Deno?.env?.get?.(key) ?? g.process?.env?.[key] ?? '') as string
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

export const twiml = (xml: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`, { headers: { 'Content-Type': 'text/xml' } })

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!))
