# Studio Funnel: product spec

What every screen does. The look is up to the design system (see KNOWLEDGE.md); the behaviour below is not.
Logic already exists in `src/engine/*` and `supabase/*`. Use it; don't rewrite it.

---

## 1. Studio page `/s/:slug`
The page a PMU studio puts in its Instagram bio, Meta ads and Google profile. Mobile first.

**Loading:** `supabase.rpc('get_public_studio', { p_slug })` returns `{ id, slug, config, texting }`. `config` has the shape `StudioConfig` in `src/engine/types.ts`; `src/engine/demoStudio.ts` is a full example. Not found → a friendly "This studio page doesn't exist" screen.

**Tracking:** on first load call `getVisit()` from `src/engine/tracking.ts`. It reads `?src=` (ig-bio, ig-dm, ig-comment, meta-ad, meta-form, google), `?campaign=`, fbclid/gclid/UTM, and gives `{ sessionId, source, campaign }` for the whole visit. Record funnel steps with `supabase.rpc('track_step', { p_slug, p_session, p_source, p_step })`, where `p_step` is `visit` (page load), `quiz_start`, `quiz_done` and `lead` (any form sent). Each step once per visit.

### Landing sections (in order)
1. Header: studio initials/logo, name, city, rating ★ + review count, a "Chat with {receptionistName}" button.
2. Hero: "{Artist name}: natural brows and lips that heal beautifully" (editable tone), artist photo placeholder, primary button **Find my match · 30 sec**, secondary **See prices**.
3. Trust row: licensed & insured, touch-up included, numbing used, {years} years, healed results shown.
4. Healed results: a gallery by treatment (Brows / Lips / Eyes / Corrections) with before/after sliders. Placeholders the studio replaces later.
5. "How it works": 1 Find your match → 2 Consult & design → 3 Heal and perfect (touch-up included).
6. Services: cards from `config.services` (name, price via `money()`, duration, "lasts", why).
7. Reviews: `config.reviews` quotes.
8. Artist: bio from `config.artist`.
9. FAQ: `config.faqs`, as an accordion.
10. Footer: address, hours, phone, Instagram.
11. **Sticky bottom bar on mobile** with "Find my match".

### Quiz (one question per screen, big tappable cards, progress bar, back button)
Content and rules are in `src/engine/quiz.ts`:
- Q1 goal: `GOALS` (brows / lips / eyes / fix).
- Q2 condition: `CONDITIONS[goal]`, heading `Q2[goal]`.
- Q3 look: `LOOKS[goal]`, heading `Q3[goal]`.
- Q4 worries: `WORRIES`, **multi-select**, then "Show my match".
- The match is `matchService(answers)`. Store answers as `QuizAnswers` `{ goal, cond, look, worries, match }`.
- `quiz_start` on the first answer, `quiz_done` on "Show my match".

### Result
The matched service (`serviceByKey(config, match)`): name, price, duration, how long it lasts, why it suits them, healing timeline, their ticked worries answered (use the matching FAQ answers), a relevant review. Then four actions:
1. **Request {service}** (booking request)
2. **Book a free 15-min consult**
3. **Not ready? Send me the price** (lead)
4. **Ask a question**

### Forms (all four save with `supabase.rpc('submit_lead', { p_slug, p_lead })`)
`p_lead` keys (camelCase): `kind`, `name`, `phone`, `email?`, `source`, `campaign?`, `quiz`, `service?`, `preferredDay?`, `preferredTime?`, `message?`, `assignedTo?`, `chat?`.
- Name is required. The phone needs at least 10 digits ("Add a 10-digit mobile number so we can reach you."). Show it as `(XXX) XXX-XXXX`.
- **Booking request** (`kind: 'booking'`, `assignedTo: 'desk'`): pick a day from the next 6 days the studio is open (skip Sundays) and a time chip (10:00 am, 11:30 am, 1:00 pm, 3:00 pm, 4:30 pm). Validation: "Pick a day and a time."
- **Free consult** (`kind: 'consult'`, `assignedTo: 'artist'`): next 5 days, times from `config.consultTimes`.
- **Send me the price** (`kind: 'lead'`, `assignedTo: 'desk'`): name + phone. The copy says "We'll text you…" if `studio.texting` is true, otherwise "We'll send you…".
- **Ask a question** (`kind: 'question'`): FAQ chips answer instantly in chat bubbles; a free-text question goes to `artist`, or to `owner` if it matches medical words (allerg, eczema, psoriasis, medication, pregnan, diabet, keloid, rosacea).
- **Every form shows this under the button:** "By sending this you agree to get texts from {studio name} about your enquiry. Msg & data rates may apply. Reply STOP to opt out."
- Errors: "Too many requests" → "You've sent a few requests already. We'll be in touch soon." Anything else → "Something went wrong. Please try again or call us."

### Confirmation screens (only promise texts when `studio.texting` is true)
- Booking: "Request sent, {first name}." + {service} · {day} at {time}. Steps: (if texting) *Right now* – a text confirming we got it; *Next* – {artist} confirms your time{ by text}, usually within {replyTime}; *To lock it in* – pay the ${deposit} deposit. If `config.bookingUrl` is set: a button "Skip the wait: book & pay deposit on {bookingTool}".
- Consult: "Your consult is booked." Steps: (if texting) a confirmation text; *Before the call* – {artist} sends you the video link; *After* – her recommendation and a link to book.
- Price: with texting, "Sent. Check your texts." (now: price and healed results; this week: a couple of check-ins, reply STOP to opt out). Without texting: "Got it." ({artist} sends you the price, usually within {replyTime}).
- Question: "Sent to {artist}." "You'll get a text back / You'll hear back, usually within {replyTime}."
- Always offer "Back to the studio page", and "While you wait: find your match" if they haven't done the quiz.

### Ava, the receptionist (chat sheet, opens from the header, the result page and a floating button)
- Rules in `src/engine/ava.ts`: the greeting is `avaGreeting(config)` with quick options; answers come from `avaAnswer(config, text)`, which returns `{ text, options[] }`. Option actions: `say` (ask that text), `quiz`, `book` (with a service), `lead`, `consult`, `ask`, `call`, `callback`.
- Optional AI: before using the rules, call the `ava-chat` function `{ slug, history: [{from:'visitor'|'bot', text}] }`. If it returns `{ text }`, use it; if `null` or an error, use `avaAnswer`. **Never send a health question (`isHealthQuestion(text)` from ava.ts) to the AI**: those are answered by `avaAnswer` from the studio's Health & safety FAQs (pregnancy, allergies, skin, medications, conditions), ending with 'confirm at a free consult / check with your doctor', with a 'Free consult' and 'Ask the owner directly' (callback to the owner) option.
- Ava always says she's the studio's virtual (automated) receptionist in the greeting.
- **Call view:** the team from `config.team` (name, role, hours) with tap-to-call `tel:` links, plus a "Request a callback" button.
- **Callback form:** who (team member, preselected by topic; health → owner), when (Morning / Afternoon / Evening), name, phone, consent line → `submit_lead` with `kind: 'callback'`, `preferredTime`, `assignedTo`, and `chat` = the conversation so far. Done: "{person} will call you in the {time}." + " You'll get a text to confirm." only if texting.
- Pass the chat transcript (`chat`) with any lead created from the chat.

---

## 2. Owner side (desktop `/dashboard`, phone `/app`)
Sign in with Supabase Auth (email + password, plus a magic link). A user can see only the studios they're a member of (the database enforces this). Load the studio with `supabase.from('studios').select('id, slug, config, messaging')`.

### Sign-up and onboarding `/signup` → `/onboarding`
1. Create an account (email, password).
2. Studio name → suggest a page address (slug) from the name. Check it with `rpc('slug_available', { p_slug })`, then show "yourdomain.com/s/{slug}".
3. Artist name, city, phone, Instagram handle.
4. Services and prices: start from the 9 services in `demoStudio.ts` (keep their `key`s: micro, powder, combo, refresh, lipblush, neutral, lash, liner, correct). Toggle on/off, edit the price.
5. Create with `rpc('create_studio', { p_slug, p_config })`, where `p_config` is the demo config with their answers filled in (keep the FAQs, reviews placeholders, team with ids `desk`, `artist`, `owner`).
6. Finish: "Your studio page is live" + copy link + "Next: connect Instagram" → Connections.

### Inbox (leads)
- `supabase.from('leads').select('*').eq('studio_id', id).order('created_at', { ascending: false })`. Realtime: subscribe to `postgres_changes` on `leads`, `lead_events`, `messages`, `followups`, `connections` filtered by `studio_id=eq.{id}` and refresh.
- Tiles: Need a reply (status `new` or `has_unread`), Callbacks due, Times to confirm, Booked.
- Filters: Needs reply, Unread texts, Instagram (`source` starts with `ig`), Meta (`meta`), Google, Bookings & consults, Callbacks, Questions. Unread first.
- Row: avatar initial with a green dot if `has_unread`; name; time; one-line summary (booking → "Wants {service} · {day} {time}"; consult; callback → "Call back · {time}"; question/lead/chat → message); kind badge; source badge (`SOURCE_LABELS`); "Waiting 3 h" in amber if status `new` for over 15 minutes; "New text" in green if unread.
- **Lead detail:**
  - Header: name, status, kind, source, phone (or "@username on Instagram" linking to instagram.com/username when `phone` is empty), a Call button (`tel:`) only if there's a phone.
  - "What they want": quiz answers (`answersLine`), worries (`worryLabels`), match + price, asked-for day/time, message, campaign.
  - Next steps: assign to a team member; Mark contacted / Mark booked / Not interested / Reopen. Update `leads.status` / `assigned_to` and insert a `lead_events` row (`type: 'status'` or `'assigned'`, `text`).
  - **Conversation** (see Texting).
  - "What happened" timeline from `lead_events` (types: source, quiz_done, submitted, chat with transcript bubbles, status, assigned, note, call_logged, text_logged, auto), plus an "Add a note" box (`type: 'note'`).
  - Opening a lead with `has_unread` sets it to false.

### Callbacks, Bookings, Report
- Callbacks: `kind = 'callback'`. Due first, with preferred time, assignee, a Call button, and "Mark as called" (event `call_logged`, status → contacted).
- Bookings: booking + consult requests grouped by requested day; confirm = Mark booked.
- Report: last 30 days from `rpc('funnel_counts', { p_studio, p_since })` → rows `{source, step, n}`. A funnel by source (Visits → Started quiz → Finished quiz → Leads) with conversion %, plus Meta lead forms as leads only.

### Texting & alerts (settings) and conversation
- `studios.messaging` is JSON (type `Messaging` in `types.ts`): `twilioNumber`, `forwardTo`, `ownerAlertPhone`, `ownerAlertEmail`, `alerts {push, sms, email}`, `autoReply`, `followups`, `missedCallTextBack`, `templates`, `followupSteps`, `igAutoReply`, `igWelcome`, `igKeywords`. Defaults via `withDefaults()`.
- Settings page: device alerts card (see Alerts), "Also tell me by text/email", studio texting number + "ring this phone for calls", automatic texts (instant reply, missed-call text-back), template editor for `TEMPLATE_INFO` with a live preview (`fill(templateFor(m,key), varsFor(studio, SAMPLE_LEAD))`) and a segment count (`segments()`), follow-up steps editor (after N hours + text, up to 5), Save.
- Conversation on the lead page: messages from `supabase.from('messages').select('*').eq('lead_id', id).order('created_at')`. In = left bubble, out = right. Meta line: "Instant reply" (sent_by auto), "Follow-up", "You", "You, in the Instagram app" (instagram-app); status Delivered / Sent / "Not sent: …" (failed) / "Not sent: they replied STOP" (blocked).
- The follow-up bar from `followups` (one per lead): active → "Follow-up {step+1} of {n} goes out {time}" + Stop (update status → stopped, stop_reason 'Stopped by the studio'); stopped → "Follow-ups stopped: {reason}"; done → "All {n} follow-up texts sent".
- Composer: quick replies (Price, Booking link, Call?, Free consult; plus "Ask for number" for Instagram leads), textarea, Send → `supabase.functions.invoke('send-sms', { body: { lead_id, body } })` → `{ ok, error }`. Show the error text if not ok.
- **Instagram leads** (`phone` empty and `ig_user_id` set): the heading "Instagram DMs with @user"; the same `send-sms` function sends it as a DM; note "Instagram allows replies up to 24 hours after their last message."
- No texting number (SMS leads) → "Set up texting" card linking to settings. Instagram lead but Instagram not connected → "Connect Instagram" card.

### Alerts
- While the app is open: when a new lead or an unread message appears (compare to the previous list), play `chime()`, show a banner at the top ("New lead: {name}" / "New Instagram DM: {name}" / "{name} texted" / "{name} messaged on Instagram") that opens the lead, and `setBadge(count)`. If the tab is hidden, `showNotification()`.
- Closed-app push: register `public/sw.js`, get the VAPID key from the `status` function (`vapidPublicKey`), and use `enableNotifications(vapidKey, saveSubscription)` from `src/engine/push.ts`. Save into `push_subscriptions` `{ studio_id, user_id, endpoint, p256dh, auth }` (delete the same endpoint first). iPhone: must be added to the Home Screen first; `enableNotifications` returns `reason: 'ios-install'` → show the steps.
- A dismissible "Turn on alerts" nudge until notifications are allowed.

### Connections
Three big cards: **Instagram** (DMs and comment keywords), **Meta ads** (lead forms and ad accounts), **Google Business Profile** (Website button, reviews, profile stats). Plus Studio number and "More options".
- Status from `supabase.from('connections').select('*').eq('studio_id', id)` (`provider`, `status` connected / needs_attention / disconnected, `account_name`, `details`, `error`, `connected_at`, `last_event_at`). The header shows "{n} of 3 connected".
- Connect: `functions.invoke('connect-start', { body: { studio_id, provider, return_to: current path } })` → `{ ok, url }` → `window.location.href = url`. The provider sends the owner back with `?connected={provider}` (green banner) or `?connect_error={provider}&reason=…` (red banner with the reason). Clear the query afterwards.
- If the `status` function says `connect[provider]` is false: disable the button, "Not set up yet".
- Disconnect: confirm → `rpc('disconnect_account', { p_studio, p_provider })`.
- Instagram connected: keyword chips (default BROWS, LIPS, BOOK, PRICE; add/remove), "Their DM" template + preview, an "Instant reply to new DMs" switch + text → save into `messaging.igKeywords / igAutoReply / igWelcome`; the bio link to copy.
- Meta connected: Pages with "Leads coming in" / "Not switched on", ad accounts, the Meta-ads tracking link.
- Google connected: location picker if several, Website button (current URL + "Use my studio page" → `functions.invoke('google-sync', { body: { studio_id, action: 'set-website' } })`), reviews (average, total, latest 2), last-30-days calls / website taps / directions, "Refresh from Google" (`action: 'refresh'`; auto-run once after connecting).
- needs_attention → an amber box with `error` and Reconnect.
- More options (collapsed): tracking links per place (`/s/{slug}?src=…`), the intake URL `{SUPABASE_URL}/functions/v1/ingest-lead?studio={slug}` + key from `rpc('get_ingest_key', { p_studio })` (hidden until "Show key") + "Send a test lead" + Zapier and ManyChat steps, and a system check from the `status` function.

### Studio page settings
Edit `studios.config`: studio details, artist, receptionist name, reply time, booking tool + link, deposit, services (name, price, duration, lasts; keep the keys), FAQs, team (role, name, phone, hours). Save → the page updates live.

### Phone app `/app` (installable)
- Bottom tabs: **Now** · **Leads** · **Callbacks** · **Stats** · **More**. Counts on Leads and Callbacks.
- Now: greeting + date; install card (Install button via `beforeinstallprompt`, or iPhone steps: Share → Add to Home Screen); alerts nudge; "Connect your accounts" card until all 3 are connected; tiles (Need a reply, Leads this week, Booked this week); "Needs you now" list (unread first, then longest waiting); "Latest".
- Leads: search by name/phone, filters, list. Lead page: back button, the conversation first, then details.
- More: Texting & alerts, Connections, Studio page settings, View my studio page, Desktop dashboard, Sign out.
- `index.html` must link `/manifest.webmanifest`, a theme colour and the apple-touch-icon. Only `/app` and `/dashboard` pages should be installable (remove the manifest link on `/s/*` pages).
- Notification taps open `/app/lead/{id}` (the service worker posts `{type:'open', url}` to an open window).

---

## 3. Server (already built, in `supabase/`)
Migrations `0001`–`0004` (tables, security, messaging, connections, sign-up). Edge functions:

| Function | Who calls it | JWT |
|---|---|---|
| `ava-chat` | studio page | off |
| `send-sms`, `connect-start`, `google-sync` | owner app (signed in) | on |
| `on-new-lead`, `run-followups`, `refresh-tokens` | database / cron (x-hook-secret) | off |
| `twilio-inbound`, `twilio-voice`, `twilio-status` | Twilio | off |
| `meta-webhook`, `meta-deauthorize`, `connect-callback` | Meta / Google | off |
| `ingest-lead` | Zapier / Make / ManyChat (x-ingest-key) | off |
| `status` | owner app | off |

Server logic tests: `tests/*.test.ts` (run with Bun).

---

## 4. Sales preview links (for outreach to studios)
Used in cold emails and personalised videos: each prospect sees the studio page and dashboard with their own studio's name. All logic is in `src/engine/preview.ts`.

**Studio page preview: `/s/preview?studio=Glow+Brows&artist=Jess&city=Bakersfield&ig=glowbrows&rating=4.9&reviews=87`**
- Only `studio` is needed. Read the params with `readPreviewParams(search)` and build the studio with `previewStudio(params)` (the sample studio re-dressed with their names; never shows "[brackets]").
- No database call. The studio has the demo id, so `isDemoStudio()` is true: nothing is tracked and forms must not call `submit_lead` (show the normal "sent" screen).
- Show a slim ribbon at the very top: "Preview made for **{studio}** · sample prices and photos · not live yet".
- Where the real page shows placeholder photo captions, show "Your healed photo goes here" instead. Hide rating, city, hours and contact when empty.
- Add `<meta name="robots" content="noindex">` and use the title "{studio} · preview". No manifest link.

**Dashboard preview: `/dashboard?studio=Glow+Brows&artist=Jess` (nobody signed in)**
- When nobody is signed in and the URL has `studio`, show the full dashboard (not the sign-in screen) filled with sample data: `sampleOwnerData(previewStudio(params), location.origin)` from `src/engine/sampleData.ts` (6 leads, texts, timeline, follow-ups and Report numbers in `counts`).
- `dashboardPreviewParams(location.search)` remembers the details for the browser tab (sessionStorage), so they survive clicking between Leads, Callbacks, Bookings, Report and settings. The same works for the phone app at `/app?studio=…`.
- It is read-only: buttons that would save or send show a toast "This is a preview. Nothing is sent." Keep it in memory only; never write to the database.
- Show a small "Preview" badge next to the studio name. "Open the studio page" uses `previewPageHref(src)`.
- A signed-in owner always sees their own real studio, never a preview.
