// Default texts. Studios can override any of these in the dashboard (Settings → Texting).
// Placeholders: {first} {service} {price} {day} {time} {when} {who} {studio} {artist} {reply_time} {link}

export type TemplateKey =
  | 'booking' | 'consult' | 'lead' | 'question' | 'callback'
  | 'missedCall' | 'ownerAlert'

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  booking: 'Hi {first}! Thanks for requesting {service} on {day} at {time}. {artist} will confirm your time by text shortly. Questions? Just reply here. – {studio}. Reply STOP to opt out.',
  consult: 'Hi {first}! Your free 15-min consult with {artist} is set for {day} at {time}. We\'ll text you the video link before the call. – {studio}. Reply STOP to opt out.',
  lead: 'Hi {first}! Here\'s the info you asked for: {service} is {price}, touch-up included. See healed results and book here: {link} – {studio}. Reply STOP to opt out.',
  question: 'Hi {first}, thanks for your question! {artist} will reply right here, usually within {reply_time}. – {studio}. Reply STOP to opt out.',
  callback: 'Hi {first}! {who} from {studio} will call you this {when}. Reply here if another time is better. Reply STOP to opt out.',
  missedCall: 'Sorry we missed your call! This is {studio}. How can we help? You can also find your perfect match and book here: {link}. Reply STOP to opt out.',
  ownerAlert: 'New lead ({source}): {name}, {what}. Open: {dashboard}',
}

export interface FollowupStep {
  afterHours: number // hours after the lead came in
  text: string
}

export const DEFAULT_FOLLOWUPS: FollowupStep[] = [
  { afterHours: 24, text: 'Hi {first}, here are some healed {service} results from our studio: {link} Any questions? Just reply.' },
  { afterHours: 72, text: 'Hi {first}, it\'s {artist} from {studio}. Did you have any questions about {service}? Happy to help.' },
  { afterHours: 168, text: 'Hi {first}, I have a few openings this week for {service}. Want me to hold one for you? {link}' },
]

export function fill(template: string, vars: Record<string, string | undefined>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString())
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** Kinds that get automatic follow-ups (people who haven't picked a time yet). */
export const FOLLOWUP_KINDS = ['lead', 'question', 'chat']

export const STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT']
export const START_WORDS = ['START', 'UNSTOP', 'YES']

// Instagram: automatic DM replies (comment keywords, first message of a new conversation).
export const DEFAULT_IG_KEYWORDS: { word: string; reply?: string }[] = [{ word: 'BROWS' }, { word: 'LIPS' }, { word: 'BOOK' }, { word: 'PRICE' }]
export const DEFAULT_IG_KEYWORD_REPLY = 'Hi {first}! Here\'s your link to find your perfect match, see prices and book: {link}'
export const DEFAULT_IG_WELCOME = 'Hi {first}, thanks for messaging {studio}! {artist} will reply here soon. Meanwhile you can find your perfect match and see prices: {link}'
