import type { StudioConfig } from './types'
import { money } from './quiz'

// Ava, the receptionist. In production the `ava-chat` Supabase function answers
// with an AI model limited to the studio's own info. These rules are the fallback
// (and what runs in demo mode). They follow the same hand-off policy:
//  - never guess; unknown questions go to a person
//  - anything medical always goes to a person

export type AvaAction =
  | { kind: 'say'; text: string } // send as if the visitor typed it
  | { kind: 'quiz' }
  | { kind: 'consult' }
  | { kind: 'lead' }
  | { kind: 'ask' }
  | { kind: 'call' }
  | { kind: 'callback' }
  | { kind: 'book'; service: string }

export interface AvaReply {
  text: string
  options: { label: string; action: AvaAction }[]
}

const say = (label: string, text = label) => ({ label, action: { kind: 'say', text } as AvaAction })

export function avaGreeting(cfg: StudioConfig): AvaReply {
  return {
    text: `Hi, I'm ${cfg.receptionistName}, the studio's virtual receptionist. I can answer questions, help you choose a treatment, get you booked, or connect you with the right person.`,
    options: [
      say('Prices'),
      { label: 'Which treatment suits me?', action: { kind: 'quiz' } },
      say('Book an appointment', 'book'),
      say('Does it hurt?'),
      { label: 'Talk to a person', action: { kind: 'call' } },
    ],
  }
}

const SERVICE_WORDS: Record<string, RegExp> = {
  micro: /microblad/,
  powder: /powder|ombr/,
  combo: /combo/,
  refresh: /refresh|faded brows/,
  lipblush: /lip blush|lip tint|lip colou?r/,
  neutral: /neutrali|dark lip/,
  lash: /lash line/,
  liner: /eyeliner|\bliner\b/,
  correct: /correct|removal|bad brows|botched/,
}

export const MEDICAL = /medical|allerg|diabet|blood thinner|keloid|medication|accutane|chemo|skin condition|eczema|psoriasis|rosacea/

export function avaAnswer(cfg: StudioConfig, input: string): AvaReply {
  const t = input.toLowerCase()
  const faq = (id: string) => cfg.faqs.find((f) => f.id === id)?.a || ''
  const owner = cfg.team.find((m) => m.id === 'owner') || cfg.team[cfg.team.length - 1]
  const hit = Object.keys(SERVICE_WORDS).find((k) => SERVICE_WORDS[k]!.test(t) && cfg.services.some((s) => s.key === k))

  if (MEDICAL.test(t))
    return {
      text: `That depends on your health history, so a person should answer it. ${owner?.name || 'The owner'} handles those questions. Want to call, or ask for a callback?`,
      options: [{ label: 'Call the right person', action: { kind: 'call' } }, { label: 'Request a callback', action: { kind: 'callback' } }],
    }
  if (/human|person|someone|real|speak|talk to|\bcall\b|phone|number/.test(t))
    return { text: 'Of course. Here is who to call for what, with their hours.', options: [{ label: 'Show me who to call', action: { kind: 'call' } }] }
  if (hit) {
    const s = cfg.services.find((x) => x.key === hit)!
    return {
      text: `${s.name} is ${money(s.price)}, touch-up included. It takes about ${s.duration} and typically lasts ${s.lasts}. ${s.why}`,
      options: [
        { label: `Book ${s.name}`, action: { kind: 'book', service: s.key } },
        { label: 'Is it right for me?', action: { kind: 'quiz' } },
        { label: 'Free consult first', action: { kind: 'consult' } },
      ],
    }
  }
  if (/price|cost|how much|\$|expensive|cheap|payment plan|afford/.test(t))
    return {
      text:
        'Here are our prices. Each one includes your touch-up:\n' +
        cfg.services.map((s) => `• ${s.name}: ${money(s.price)}`).join('\n') +
        `\nA ${money(cfg.deposit)} deposit holds your time and comes off the total.`,
      options: [{ label: 'Which one suits me?', action: { kind: 'quiz' } }, { label: 'Send me the price list', action: { kind: 'lead' } }],
    }
  if (/hurt|pain|numb/.test(t)) return { text: faq('pain'), options: [say('What is healing like?', 'healing'), { label: 'Free 15-min consult', action: { kind: 'consult' } }] }
  if (/heal|downtime|scab|flak|aftercare|go to work/.test(t)) return { text: faq('heal'), options: [say('How long does it last?'), { label: 'Find my match', action: { kind: 'quiz' } }] }
  if (/pregnan|breastfeed|nursing/.test(t)) return { text: faq('preg'), options: [{ label: 'Talk to a person', action: { kind: 'call' } }] }
  if (/how long|\blast\b|fade/.test(t)) return { text: faq('last'), options: [say('Prices')] }
  if (/touch.?up/.test(t)) return { text: 'Your 6–8 week touch-up is included in every price.', options: [say('Prices')] }
  if (/deposit|cancel|resched|refund/.test(t))
    return { text: `A ${money(cfg.deposit)} deposit holds your time and comes off your total. You can reschedule free up to ${cfg.reschedule} before.`, options: [say('Book an appointment', 'book')] }
  if (/hour|open today|what time|close|weekend|saturday|sunday/.test(t)) return { text: `We're open ${cfg.hours}.`, options: [say('Book an appointment', 'book')] }
  if (/where|address|locat|park|direction/.test(t)) return { text: `We're at ${cfg.address}. Parking details come with your confirmation text.`, options: [say('Book an appointment', 'book')] }
  if (/fake|natural|shape|suit|which|recommend|right for me|best for me|not sure/.test(t))
    return { text: faq('fake') + ' Not sure which treatment suits you? The 30-second match recommends one.', options: [{ label: 'Find my match', action: { kind: 'quiz' } }, { label: 'Free 15-min consult', action: { kind: 'consult' } }] }
  if (/book|appointment|availab|slot|schedule|opening|when can|reserve/.test(t))
    return {
      text: 'Happy to get you booked. Do you know which treatment you want, or should I help you pick?',
      options: [
        { label: 'Help me pick', action: { kind: 'quiz' } },
        ...cfg.services.slice(0, 3).map((s) => ({ label: s.name, action: { kind: 'book', service: s.key } as AvaAction })),
        { label: 'Free consult first', action: { kind: 'consult' } },
      ],
    }
  if (/^(hi|hey|hello|hola|good (morning|afternoon|evening))/.test(t))
    return { text: 'Hi! What can I help you with today?', options: [say('Prices'), { label: 'Which treatment suits me?', action: { kind: 'quiz' } }, { label: 'Talk to a person', action: { kind: 'call' } }] }
  return {
    text: `I'm not sure about that one, and I'd rather not guess. I can pass it to ${cfg.artist.name}, who usually replies within ${cfg.replyTime}, or you can call the right person now.`,
    options: [{ label: `Send it to ${cfg.artist.name}`, action: { kind: 'ask' } }, { label: 'Call the right person', action: { kind: 'call' } }],
  }
}
