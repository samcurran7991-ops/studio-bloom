// Phone / desktop push notifications for the owner (work even when the app is closed).
import { askNotifyPermission } from './alerts'

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Registers the service worker (safe to call more than once). Skipped in single-file previews. */
export async function registerSw(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.register('/sw.js') } catch { return null }
}

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export interface PushResult {
  ok: boolean
  level?: 'push' | 'open-only'
  reason?: 'denied' | 'ios-install' | 'unsupported' | 'error'
  error?: string | undefined
}

/**
 * Turns on notifications for this device.
 * 'push'      → alerts arrive even when the app is closed (server has VAPID keys).
 * 'open-only' → alerts show while the app or dashboard is open (demo, or push keys not set yet).
 */
/**
 * saveSubscription: store the subscription for this studio + user, e.g. insert into the push_subscriptions table
 * (studio_id, user_id, endpoint, p256dh = sub.keys.p256dh, auth = sub.keys.auth), deleting any old row with the same endpoint first.
 */
export async function enableNotifications(
  vapidPublicKey: string | null,
  saveSubscription: (sub: PushSubscriptionJSON) => Promise<{ ok: boolean; error?: string | undefined }>,
): Promise<PushResult> {
  if (isIos() && !isStandalone()) return { ok: false, reason: 'ios-install' }
  const perm = await askNotifyPermission()
  if (perm === 'unsupported') return { ok: false, reason: 'unsupported' }
  if (perm !== 'granted') return { ok: false, reason: 'denied' }
  if (!vapidPublicKey || !pushSupported()) return { ok: true, level: 'open-only' }
  try {
    const reg = (await registerSw()) || (await navigator.serviceWorker.ready)
    const existing = await reg.pushManager.getSubscription()
    const sub = existing || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }))
    const r = await saveSubscription(sub.toJSON())
    return r.ok ? { ok: true, level: 'push' } : { ok: false, reason: 'error', error: r.error }
  } catch (e: any) {
    return { ok: false, reason: 'error', error: e?.message || String(e) }
  }
}

/** removeSubscription: delete the push_subscriptions row with this endpoint. */
export async function disableNotifications(removeSubscription: (endpoint: string) => Promise<void>) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) { await removeSubscription(sub.endpoint); await sub.unsubscribe() }
  } catch { /* ignore */ }
}

export async function hasPushSubscription() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    return Boolean(await reg?.pushManager.getSubscription())
  } catch { return false }
}
