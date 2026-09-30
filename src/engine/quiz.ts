import type { QuizAnswers, ServiceKey, StudioConfig } from './types'

// Standard PMU quiz content. Wording can be adjusted per studio later.
export const GOALS: [string, string, string][] = [
  ['brows', 'Brows', 'Microblading, powder or combo'],
  ['lips', 'Lips', 'Lip blush or neutralization'],
  ['eyes', 'Eyeliner', 'Lash line or classic liner'],
  ['fix', 'Fix old work', 'Faded, discoloured or misshaped'],
]

export const CONDITIONS: Record<string, [string, string][]> = {
  brows: [['sparse', 'Thin or sparse'], ['gaps', 'Over-plucked, with gaps'], ['full', 'Fairly full, I want shape'], ['old', 'Done before, now faded']],
  lips: [['pale', 'Pale or uneven colour'], ['shape', 'I want more definition'], ['dark', 'Darker lips I want to even out']],
  eyes: [['sparse', 'My lashes look sparse'], ['daily', 'I draw liner every day'], ['water', 'Sensitive or watery eyes']],
  fix: [['faded', 'Faded or patchy'], ['colour', 'Turned red, grey or blue'], ['shape', 'The shape is wrong']],
}

export const LOOKS: Record<string, [string, string, string][]> = {
  brows: [['natural', 'Soft hair strokes', 'Natural, like real brow hairs'], ['powder', 'Soft powdered look', 'Like lightly filled-in makeup'], ['unsure', 'Not sure', 'Recommend what suits me']],
  lips: [['natural', 'A natural tint', 'My lips, just better'], ['bold', 'Fuller and defined', 'Visible colour and edges'], ['unsure', 'Not sure', 'Recommend what suits me']],
  eyes: [['natural', 'Barely there', 'Just fuller-looking lashes'], ['bold', 'A visible liner', 'Defined, every day'], ['unsure', 'Not sure', 'Recommend what suits me']],
  fix: [['refresh', 'Refresh what I have', 'Bring the colour back'], ['correct', 'Change colour or shape', 'Correct the old work'], ['unsure', 'Not sure', 'Tell me what is possible']],
}

export const Q2: Record<string, string> = {
  brows: 'How are your brows today?',
  lips: 'How are your lips today?',
  eyes: 'What bothers you about your eyes?',
  fix: 'What happened with your old work?',
}
export const Q3: Record<string, string> = {
  brows: 'What look do you want?',
  lips: 'What look do you want?',
  eyes: 'How visible should it be?',
  fix: 'What would you like to do?',
}

export const WORRIES: [string, string][] = [
  ['pain', 'Will it hurt?'],
  ['fake', 'Looking fake or harsh'],
  ['heal', 'Healing and downtime'],
  ['price', 'The total cost'],
  ['suit', 'Whether it will suit me'],
]

// Recommendation rules. Returns a service key that must exist in the studio's services.
export function matchService(a: QuizAnswers): ServiceKey {
  if (a.goal === 'lips') return a.cond === 'dark' ? 'neutral' : 'lipblush'
  if (a.goal === 'eyes') return a.cond === 'water' || a.look !== 'bold' ? 'lash' : 'liner'
  if (a.goal === 'fix') return a.cond === 'faded' && a.look === 'refresh' ? 'refresh' : 'correct'
  if (a.cond === 'old') return 'refresh'
  if (a.look === 'natural') return a.cond === 'gaps' ? 'combo' : 'micro'
  if (a.look === 'powder') return 'powder'
  if (a.look === 'unsure') return ({ sparse: 'combo', gaps: 'powder', full: 'micro' } as Record<string, string>)[a.cond || ''] || 'combo'
  return 'combo'
}

export function serviceByKey(cfg: StudioConfig, key?: ServiceKey) {
  return cfg.services.find((s) => s.key === key) || cfg.services[0]
}

// Human-readable summary, e.g. "Brows · Thin or sparse · Not sure"
export function answersLine(a: QuizAnswers): string {
  const g = GOALS.find((x) => x[0] === a.goal)?.[1]
  const c = CONDITIONS[a.goal || '']?.find((x) => x[0] === a.cond)?.[1]
  const l = LOOKS[a.goal || '']?.find((x) => x[0] === a.look)?.[1]
  return [g, c, l].filter(Boolean).join(' · ')
}

export function worryLabels(ids: string[] = []): string {
  return ids.map((id) => WORRIES.find((w) => w[0] === id)?.[1]?.replace('?', '')).filter(Boolean).join(', ')
}

export const money = (n: number) => '$' + n.toLocaleString('en-US')
