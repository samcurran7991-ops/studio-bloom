// Shared types for the funnel, the dashboard and the data layer.

export type ServiceKey = string

export interface Service {
  key: ServiceKey
  name: string
  group: 'brows' | 'lips' | 'eyes' | 'fix'
  price: number
  duration: string
  lasts: string
  why: string
}

export interface Faq {
  id: string
  q: string
  a: string
  /** 'health' = a health & safety answer Ava gives word for word (pregnancy, allergies, skin, medications, conditions). */
  group?: 'health'
}

export interface TeamMember {
  id: string
  role: string // what they handle, e.g. "Bookings and rescheduling"
  name: string
  title: string
  phone: string
  hours: string
}

export interface StudioConfig {
  name: string
  initials: string
  city: string
  artist: { name: string; title: string; years: string; bio: string }
  rating: string
  reviewCount: string
  replyTime: string
  deposit: number
  reschedule: string
  address: string
  hours: string
  instagram: string
  phone: string
  bookingUrl: string // their existing GlossGenius / Square / Vagaro link
  bookingTool: string
  receptionistName: string
  services: Service[]
  faqs: Faq[]
  team: TeamMember[]
  reviews: Record<string, string> // keyed by goal (brows/lips/eyes/fix/any)
  consultTimes: string[]
}

export interface Studio {
  id: string
  slug: string
  config: StudioConfig
  /** True once the studio has a texting number and instant replies are on (set by the server). */
  texting?: boolean
}

// ---------------------------------------------------------------- texting & alerts
export type TemplateKey = 'booking' | 'consult' | 'lead' | 'question' | 'callback' | 'missedCall' | 'ownerAlert'
export interface FollowupStep { afterHours: number; text: string }

/** Per-studio texting and alert settings (studios.messaging). Mirrors supabase/functions/_shared/core.ts. */
export interface Messaging {
  twilioNumber?: string
  forwardTo?: string
  ownerAlertPhone?: string
  ownerAlertEmail?: string
  alerts?: { push?: boolean; sms?: boolean; email?: boolean }
  autoReply?: boolean
  followups?: boolean
  missedCallTextBack?: boolean
  callSource?: string
  templates?: Partial<Record<TemplateKey, string>>
  followupSteps?: FollowupStep[]
  /** Instagram: reply to the first DM of a new conversation automatically (default on). */
  igAutoReply?: boolean
  igWelcome?: string
  /** Instagram: comment/DM keywords that get the studio link by DM. */
  igKeywords?: { word: string; reply?: string }[]
}

// ---------------------------------------------------------------- one-tap account connections
export type Provider = 'instagram' | 'meta' | 'google'
export interface Connection {
  provider: Provider
  status: 'connected' | 'needs_attention' | 'disconnected'
  accountName?: string
  details: any
  error?: string
  connectedAt: string
  lastEventAt?: string
}

export interface Message {
  id: string
  leadId: string
  direction: 'in' | 'out'
  body: string
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received' | 'blocked'
  sentBy?: string
  error?: string
  at: string
  channel?: 'sms' | 'instagram'
}

export interface Followup {
  leadId: string
  step: number
  nextAt?: string
  status: 'active' | 'stopped' | 'done'
  stopReason?: string
}

/** Which outside services are switched on for this install (no secrets). */
export interface ServiceStatus {
  reachable: boolean
  texting: boolean
  email: boolean
  ai: boolean
  push: boolean
  vapidPublicKey: string | null
  alertsHook: boolean
  /** Which one-tap connections have app ids/secrets on the server. */
  connect?: Record<Provider, boolean>
}

export type LeadKind = 'booking' | 'consult' | 'lead' | 'question' | 'callback' | 'chat'
export type LeadStatus = 'new' | 'contacted' | 'booked' | 'lost'

// Where the visitor came from. Set by ?src= on the link (see tracking.ts).
export type Source = 'ig-bio' | 'ig-dm' | 'ig-comment' | 'meta-ad' | 'meta-form' | 'google' | 'direct'

export interface QuizAnswers {
  goal?: string
  cond?: string
  look?: string
  worries?: string[]
  match?: ServiceKey
}

export interface Lead {
  id: string
  studioId: string
  kind: LeadKind
  status: LeadStatus
  name: string
  phone: string
  email?: string
  source: Source
  campaign?: string
  quiz: QuizAnswers
  service?: ServiceKey
  preferredDay?: string
  preferredTime?: string
  message?: string
  assignedTo?: string // team member id
  createdAt: string
  updatedAt: string
  hasUnread?: boolean
  lastMessageAt?: string
  /** Leads from Instagram DMs/comments: no phone until they share it. */
  igUserId?: string
  igUsername?: string
}

export type EventType =
  | 'source'
  | 'quiz_done'
  | 'submitted'
  | 'chat'
  | 'status'
  | 'assigned'
  | 'note'
  | 'call_logged'
  | 'text_logged'
  | 'auto'

export interface LeadEvent {
  id: string
  leadId: string
  at: string
  type: EventType
  text: string
  chat?: { from: 'visitor' | 'bot'; text: string }[]
}

export type FunnelStep = 'visit' | 'quiz_start' | 'quiz_done' | 'lead'

export interface NewLeadInput {
  kind: LeadKind
  name: string
  phone: string
  email?: string
  source: Source
  campaign?: string
  quiz: QuizAnswers
  service?: ServiceKey
  preferredDay?: string
  preferredTime?: string
  message?: string
  assignedTo?: string
  chat?: { from: 'visitor' | 'bot'; text: string }[]
}

export interface ChatTurn {
  from: 'visitor' | 'bot'
  text: string
}
