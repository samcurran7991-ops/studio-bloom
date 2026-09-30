// Minimal PostgREST client using the service-role key (server-side only).
// No npm dependency, so it runs the same in Supabase Edge Functions and in tests.
import { env } from './env.ts'

export type Db = ReturnType<typeof makeDb>

export function makeDb(url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY'), f: typeof fetch = (...a) => fetch(...a)) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await f(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) } })
    const text = await r.text()
    if (!r.ok) throw new Error(`db ${init.method || 'GET'} ${path.split('?')[0]} ${r.status}: ${text.slice(0, 200)}`)
    return text ? JSON.parse(text) : null
  }
  return {
    select: (table: string, query: string): Promise<any[]> => call(`${table}?${query}`),
    one: async (table: string, query: string): Promise<any | null> => (await call(`${table}?${query}&limit=1`))?.[0] ?? null,
    insert: (table: string, rows: unknown): Promise<any[]> => call(table, { method: 'POST', body: JSON.stringify(rows), headers: { Prefer: 'return=representation' } }),
    upsert: (table: string, rows: unknown, onConflict: string): Promise<any[]> =>
      call(`${table}?on_conflict=${onConflict}`, { method: 'POST', body: JSON.stringify(rows), headers: { Prefer: 'return=representation,resolution=ignore-duplicates' } }),
    update: (table: string, query: string, patch: unknown): Promise<any[]> => call(`${table}?${query}`, { method: 'PATCH', body: JSON.stringify(patch), headers: { Prefer: 'return=representation' } }),
    remove: (table: string, query: string): Promise<any[]> => call(`${table}?${query}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }),
    rpc: (fn: string, args: unknown): Promise<any> => call(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }),
  }
}

export const eq = (v: string) => 'eq.' + encodeURIComponent(v)
