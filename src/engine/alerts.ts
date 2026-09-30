// In-app alerts for the owner: a chime, a count in the tab title / app icon, and a phone/desktop
// notification. Real push notifications (when the app is closed) come from the server via sw.js;
// these cover the time the app or dashboard is open.

let ctx: AudioContext | null = null
export function chime() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    ctx ||= new AC()
    const c = ctx!
    const now = c.currentTime
    ;[880, 1320].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, now + i * 0.14)
      g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.14 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.35)
      o.connect(g).connect(c.destination)
      o.start(now + i * 0.14); o.stop(now + i * 0.14 + 0.4)
    })
  } catch { /* sound is optional */ }
}

const baseTitle = typeof document !== 'undefined' ? document.title : ''
/** Shows "(3) Studio" in the tab and a number on the installed app's icon. */
export function setBadge(n: number) {
  try {
    document.title = n > 0 ? `(${n}) ${baseTitle.replace(/^\(\d+\)\s*/, '')}` : baseTitle
    const nav = navigator as any
    if (n > 0) nav.setAppBadge?.(n)?.catch?.(() => {})
    else nav.clearAppBadge?.()?.catch?.(() => {})
  } catch { /* not supported */ }
}

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window
export const notifyPermission = (): NotificationPermission | 'unsupported' => (notifySupported() ? Notification.permission : 'unsupported')

export async function askNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notifySupported()) return 'unsupported'
  try { return await Notification.requestPermission() } catch { return Notification.permission }
}

/** Shows a system notification. Tapping it opens `url` inside the app. */
export async function showNotification(title: string, body: string, url: string, tag?: string) {
  if (notifyPermission() !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) { await reg.showNotification(title, { body, tag, data: { url }, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' } as NotificationOptions); return true }
    const n = new Notification(title, tag ? { body, tag } : { body })
    n.onclick = () => { window.focus(); window.dispatchEvent(new CustomEvent('sf-open', { detail: url })); n.close() }
    return true
  } catch { return false }
}
