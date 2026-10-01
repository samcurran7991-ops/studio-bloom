# Building Studio Funnel in Lovable: step by step

Do the steps in order. Paste one prompt at a time, wait for Lovable to finish, and do the checks before the next one. If something goes wrong, see "If Lovable goes off track" at the end.

## Setup: Get set up
About 20 minutes: two prompts and a few clicks.

### Create the Lovable project with Prompt 1
Open lovable.dev, start a new project, and paste **Prompt 1** as the very first message. Lovable builds the design foundation. Don't move on until the preview shows the style guide page.

### Prompt 1: design foundation
```
Build the foundation for "Studio Funnel", a lead-to-booking app for permanent makeup (PMU) studios. Don't build real features yet; just the design system and empty page shells.

Design direction: calm, clean, expensive, like a boutique clinic crossed with a skincare brand. Not a SaaS template.
- Colours: warm neutrals (bone #F6F1EC background, sand #E9DFD6, taupe #8C7B70 for muted text), one deep mulberry accent #7A2E48, sage #5E7F68 for success, a soft amber for "waiting". Ink #2A1F22 for text, never pure black. Include a dark mode.
- Fonts: Fraunces for headings, Manrope for everything else.
- Rounded 16–20px cards, soft shadows, generous spacing, mobile-first, tap targets at least 44px.
- Set the colours up as theme tokens so the accent colour can be swapped per studio later.

Create these reusable components with Tailwind and shadcn/ui: Button (primary, secondary, quiet), Card, selectable Chip, Badge (source badges: Instagram, Meta, Google, Direct; status badges: New, Contacted, Booked, Not interested), Input, Textarea, Switch, bottom Sheet, Toast, Avatar with an unread dot, EmptyState, stat Tile, and a before/after image slider.

Create these routes with a simple placeholder heading on each:
/ (home), /styleguide (shows every component), /s/:slug (studio page), /login, /signup, /onboarding, /dashboard, /dashboard/:view, /dashboard/:view/:id, /app, /app/:view, /app/:view/:id.

Make /styleguide look polished; it's the reference for everything else.
```

**Check:**
- The preview opens /styleguide with buttons, cards, badges and the slider.
- It looks warm and premium on a phone-sized preview too.
- Ask for changes now ("make the accent a bit softer") until you love it. Everything later builds on this.

### Turn on the backend (Lovable Cloud)
In your Lovable project, open **Cloud** (or **Integrations → Lovable Cloud**) and enable it. This gives the app its database, logins and server functions. (If you'd rather use your own Supabase account, connect it here instead; everything below works the same.)

### Connect GitHub
In Lovable: **Settings → GitHub → Connect**, and let it create a repository. Note the repository name (for example `sam/studio-funnel`). This is how the ready-made pieces get into your project.

### Add the starter kit to the project
The starter kit (`studio-funnel-lovable-kit.zip`) holds everything already built and tested: the database, the server functions, the quiz and receptionist logic, the app icons and notifications, and the spec. Two ways to add it:

- **Easiest:** send Claude the repository name from the last step and say "add the starter kit". Claude pushes it for you.
- **Yourself:** unzip the kit. On github.com open your repository → **Add file → Upload files**, drag in everything from inside the kit folder (`supabase`, `src`, `public`, `tests`, `SPEC.md`, `KNOWLEDGE.md`), and click **Commit changes**.

Within a minute Lovable shows the new files (look for `SPEC.md` in the code view).

### Give Lovable the project rules
In Lovable: **Project settings → Knowledge**. Paste the whole of `KNOWLEDGE.md` from the kit and save. Lovable reads this before every change, so it knows what to protect and how things should look.

### Prompt 2: read the starter kit
```
I've added a starter kit to this project: SPEC.md, KNOWLEDGE.md, src/engine/, supabase/migrations/, supabase/functions/, public/sw.js, public/manifest.webmanifest, public/icons/ and tests/.

Please read SPEC.md and KNOWLEDGE.md fully, and skim src/engine and supabase. Then tell me, in plain language:
1. The three parts of the product and the main screens of each.
2. Which files hold logic you must reuse rather than rewrite.
3. The order you'd build things in, following SPEC.md.

Don't change any files in this step.
```

**Check:**
- Lovable explains the studio page, dashboard and phone app back to you correctly.
- It mentions reusing src/engine and not changing supabase. If it says it will rewrite them, reply: "No, reuse them as they are."

## Phase A: The studio page
What Instagram visitors see. The page that earns the money, so it gets the most care.

### Prompt 3: studio landing page
```
Build the studio page landing at /s/:slug following SPEC.md section 1 ("Landing sections"), using the design system.

For now, load the studio from src/engine/demoStudio.ts (DEMO_STUDIO) for any slug, so we can design without the database. Treat studio.texting as true.

Include every section in order: header with rating and "Chat with {receptionistName}", hero with the "Find my match · 30 sec" button, trust row, healed-results gallery with before/after sliders (tasteful neutral placeholders, no stock faces), how it works, services with prices (use money() from src/engine/quiz.ts), reviews, artist, FAQ accordion, footer, and a sticky "Find my match" bar on mobile.

Make it feel like a premium PMU studio: elegant, reassuring, not salesy. Check it at 360px and 1280px.
```

**Check:**
- Open /s/demo in the preview on phone size: it should look like a real high-end studio site.
- All the text comes from the sample studio (Arch & Ink, Maya).
- The "Find my match" bar stays at the bottom on a phone.

### Prompt 4: the match quiz and result
```
Build the match quiz and result screen on the studio page, following SPEC.md ("Quiz" and "Result").

Use src/engine/quiz.ts exactly: GOALS, CONDITIONS, LOOKS, Q2, Q3, WORRIES and matchService(). Don't retype the questions; import them.
- One question per screen with big tappable cards (a small icon or illustration each), a progress bar, a back button and a gentle transition.
- Q4 (worries) is multi-select, then a "Show my match" button.
- The result shows the matched service (serviceByKey), price, duration, how long it lasts, why it suits them, a simple healing timeline, their ticked worries answered using the studio's FAQs, a review, and four buttons: "Request {service}", "Book a free 15-min consult", "Not ready? Send me the price", "Ask a question". The buttons can go to placeholder screens for now.

Keep the answers in state as { goal, cond, look, worries, match }.
```

**Check:**
- Take the quiz on a phone-size preview: Brows → Thin or sparse → Not sure → tick two worries → Show my match. You should get "Combo Brows" with its price.
- Each screen has one clear thing to tap.

### Prompt 5: set up the database
```
Set up the database using the SQL files in supabase/migrations, in this order: 0001_init.sql, 0002_messaging.sql, 0003_connections.sql, 0004_onboarding.sql. Run them exactly as written (don't edit them). If a line fails because an extension or publication already exists, tell me which line and why before changing anything.

Then run supabase/seed.sql to add the sample studio "arch-and-ink".

Then switch the studio page to load real data: call supabase.rpc('get_public_studio', { p_slug: slug }), which returns { id, slug, config, texting }. Show a friendly "This studio page doesn't exist" screen when it returns null. Keep DEMO_STUDIO only as the fallback for /s/demo.
```

**Check:**
- Lovable shows the migrations ran; approve them when asked.
- /s/arch-and-ink loads from the database (the text will have [brackets] where a real studio fills in details; that's expected).
- /s/nothing-here shows the "doesn't exist" screen.

### Prompt 6: the four forms, tracking and confirmations
```
Build the four studio-page forms and their confirmation screens, following SPEC.md ("Forms", "Confirmation screens" and "Tracking").

- Booking request, free consult, "send me the price", and ask a question, with the exact fields, validation messages and assignedTo values in SPEC.md.
- Save each with supabase.rpc('submit_lead', { p_slug, p_lead }), using the camelCase keys listed in SPEC.md, including source and campaign from getVisit() (src/engine/tracking.ts) and the quiz answers.
- Every form shows the SMS consent line from SPEC.md under the button.
- Confirmation screens only promise texts when studio.texting is true.
- Track funnel steps with supabase.rpc('track_step', ...) once per visit: visit, quiz_start, quiz_done, lead.
- Handle errors with the friendly messages in SPEC.md.
```

**Check:**
- Open /s/arch-and-ink?src=ig-bio, take the quiz, request a time. You should see "Request sent, {your name}."
- Try sending without a phone number: you get the friendly error.
- The consent line is under every form button.

### Prompt 7: Ava, the receptionist
```
Build Ava, the receptionist chat, following SPEC.md ("Ava, the receptionist").

- A polished chat sheet that opens from the header button, the result screen and a floating button. Typing indicator, quick-option chips under Ava's messages.
- Use avaGreeting() and avaAnswer() from src/engine/ava.ts for replies and options. Handle every option action: say, quiz, book, lead, consult, ask, call, callback.
- Optional AI: before using the rules, call supabase.functions.invoke('ava-chat', { body: { slug, history } }). If it returns text, use it; if it returns null or fails, use avaAnswer(). Never send a health question (isHealthQuestion from ava.ts) to the AI: avaAnswer() answers those from the studio's Health & safety FAQs.
- The call view lists the team with tap-to-call links, and a callback form (who, when, name, phone, consent line) saves a lead with kind 'callback' and the chat transcript.
- Ava introduces herself as the studio's virtual receptionist.
```

**Check:**
- Ask Ava "how much is microblading" → she answers with the price.
- Ask "I have eczema, can I get brows?" → she answers from the studio's Health & safety policy and suggests a free consult or asking the owner.
- Request a callback → you see "{person} will call you in the {time}."

## Phase B: The owner dashboard
Sign-up, the inbox, and the pages owners use every day.

### Prompt 8: sign-up, login and onboarding
```
Build owner sign-up, login and onboarding, following SPEC.md ("Sign-up and onboarding").

- /signup and /login with email + password (and a "email me a login link" option), using Supabase Auth.
- /onboarding: a friendly step-by-step wizard (progress dots): studio name → page address with a live availability check via supabase.rpc('slug_available', { p_slug }) → artist name, city, phone, Instagram → services and prices (start from the 9 services in DEMO_STUDIO, keep their keys, toggle and edit prices) → create with supabase.rpc('create_studio', { p_slug, p_config }), where p_config is DEMO_STUDIO.config with their answers filled in.
- Finish screen: "Your studio page is live", the link with a Copy button, and "Next: connect Instagram".
- After login, owners with no studio go to /onboarding; owners with a studio go to /dashboard (or /app on a phone).
- Protect /dashboard, /app and /onboarding: not signed in → /login.
```

**Check:**
- Sign up with a new email, go through onboarding, open your new studio page link.
- Log out and log in again: you land on the dashboard.

### Prompt 9: the inbox and lead page
```
Build the owner dashboard inbox at /dashboard, following SPEC.md ("Inbox (leads)").

- Desktop layout: a left navigation (All leads, Callbacks, Bookings, Report, Texting & alerts, Connections, Studio page), then the lead list, then the lead detail.
- Tiles, filters, list rows with source badges, "Waiting 3 h" and "New text" markers, unread first, exactly as described.
- Lead detail: header (Call only when there's a phone; "@username on Instagram" for Instagram leads), "What they want" (use answersLine and worryLabels from src/engine/quiz.ts), next steps (assign, status buttons, each saving a lead_events row), and the "What happened" timeline with notes. Use SOURCE_LABELS, KIND_LABELS, STATUS_LABELS, timeAgo and clockTime from src/engine/labels.ts.
- Leave a clearly marked empty "Conversation" panel on the lead page; we fill it in Prompt 12.
- Realtime: subscribe to leads, lead_events, messages, followups and connections for this studio and refresh when they change, so a new lead appears without reloading.
- Opening a lead that has has_unread = true sets it to false.
- On screens under 1060px, show the list, and the detail full-screen with a back button.
```

**Check:**
- Keep the dashboard open in one tab. In another tab, submit a form on your studio page. The lead appears in the dashboard within seconds, with the right source badge.
- Open it, mark it contacted, add a note: they show in the timeline.

### Prompt 10: callbacks, bookings, report, studio page settings
```
Build the remaining everyday owner pages, following SPEC.md ("Callbacks, Bookings, Report" and "Studio page settings").

- Callbacks: due first, with preferred time, assignee, Call button and "Mark as called".
- Bookings: booking and consult requests grouped by requested day, with "Mark booked".
- Report: last 30 days from supabase.rpc('funnel_counts', { p_studio, p_since }). A clean funnel by source (Visits → Started quiz → Finished quiz → Leads) with conversion percentages, plus Meta lead forms. Keep the chart simple and readable.
- Studio page settings: edit studios.config (studio details, artist, receptionist name, reply time, booking tool and link, deposit, services with prices (keep the keys), FAQs, team). Save updates the live studio page.
```

**Check:**
- Change a price in Studio page settings, save, reload your studio page: the new price shows.
- The Report shows your test visits and leads.

## Phase C: Texting and alerts
Plugging in the server pieces we already built and tested.

### Prompt 11: switch on the server functions
```
Deploy every edge function in supabase/functions exactly as written (they share code in supabase/functions/_shared). Don't rewrite them.

In supabase/config.toml, set verify_jwt = false for these functions (they check their own secret or signature): ava-chat, on-new-lead, run-followups, refresh-tokens, twilio-inbound, twilio-voice, twilio-status, meta-webhook, meta-deauthorize, connect-callback, ingest-lead, status. Keep verify_jwt = true for send-sms, connect-start and google-sync.

Add these secrets with empty or placeholder values for now, and tell me where to fill them in later: FUNCTIONS_URL, APP_URL, HOOK_SECRET (generate a long random value), TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, RESEND_API_KEY, ALERT_FROM_EMAIL, ANTHROPIC_API_KEY, META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

Then run this SQL so the database can call the functions (fill in the real functions URL and the same HOOK_SECRET):
insert into private.config (key, value) values ('functions_url', '<functions URL>'), ('hook_secret', '<HOOK_SECRET>') on conflict (key) do update set value = excluded.value;

Finally, enable the pg_net and pg_cron extensions and run the two commented cron.schedule blocks at the end of 0002_messaging.sql and 0003_connections.sql.
```

**Check:**
- Lovable lists all functions as deployed.
- Ask Lovable: "Call the status function and show me the result." It should answer with texting / push / email switched off (normal until the keys are added).

### Prompt 12: texting on the lead page, and texting settings
```
Build texting, following SPEC.md ("Texting & alerts (settings) and conversation").

1) Fill in the Conversation panel on the lead page: message bubbles from the messages table, sender and status line, the follow-up bar (with Stop), quick replies, and a composer that sends with supabase.functions.invoke('send-sms', { body: { lead_id, body } }), showing any error it returns. Instagram leads (no phone, ig_user_id set) show "Instagram DMs with @user" and the 24-hour note. Show the "Set up texting" or "Connect Instagram" card when needed.

2) A "Texting & alerts" page that edits studios.messaging: alert channels, the owner's alert phone/email, the studio texting number and "ring this phone for calls", instant reply and missed-call text-back switches, the template editor for every item in TEMPLATE_INFO with a live preview and text count (fill, templateFor, varsFor, SAMPLE_LEAD, segments from src/engine/texting.ts), and the follow-up steps editor. Use withDefaults() for defaults.

Once the Twilio keys are added, texts will actually send. Until then the composer shows the function's error text, which is expected.
```

**Check:**
- The lead page shows the conversation panel and quick replies.
- On the Texting & alerts page, edit the "Price & guide" template: the preview updates as you type.
- Sending a text now shows "Texting is not set up (Twilio keys missing)". That's correct until Twilio is connected.

### Prompt 13: live alerts and phone notifications
```
Build owner alerts, following SPEC.md ("Alerts").

- While the dashboard or app is open: when a new lead or an unread message arrives (compare with the previous list after each realtime refresh), play chime(), show a banner at the top that opens the lead, update the badge with setBadge(count), and use showNotification() when the tab is hidden. All from src/engine/alerts.ts. A "Play a sound" switch (remember it on this device).
- Phone notifications when the app is closed: register public/sw.js, get vapidPublicKey from the status function, and call enableNotifications(vapidKey, saveSubscription) from src/engine/push.ts. saveSubscription deletes any push_subscriptions row with the same endpoint, then inserts { studio_id, user_id, endpoint, p256dh, auth }. Handle every result: push, open-only, denied, ios-install (show the Add to Home Screen steps), unsupported.
- An "Alerts on this device" card on the Texting & alerts page, and a dismissible "Turn on alerts" nudge at the top of the dashboard until notifications are allowed.
- When the service worker posts { type: 'open', url }, navigate to that url.
```

**Check:**
- Keep the dashboard open, submit a lead on the studio page from another tab: a banner pops up with a chime and opens the lead when you tap it.
- Turn on alerts: your browser asks for permission and shows a test notification.

## Phase D: The phone app
The installable app owners keep on their home screen.

### Prompt 14: the owner phone app
```
Build the owner phone app at /app, following SPEC.md ("Phone app /app").

- It should feel like a messaging app: bottom tabs (Now, Leads, Callbacks, Stats, More) with counts, big touch targets, and the composer pinned at the bottom of the conversation.
- Now: greeting and date, install card (Install button via beforeinstallprompt, or iPhone steps), alerts nudge, "Connect your accounts" card until all three connections are on, tiles, "Needs you now" (unread first, then longest waiting) and "Latest".
- Leads: search by name or phone, filter chips, list. Lead page: back button, the conversation first, then details and the timeline. Reuse the dashboard components.
- Callbacks and Stats reuse the dashboard pages in a single column. More: Texting & alerts, Connections, Studio page settings, View my studio page, Desktop dashboard, Sign out.
- Installable: link /manifest.webmanifest, the theme colour #7A2E48 and /icons/apple-touch-icon.png in index.html; only /app and /dashboard pages are installable (remove the manifest link on /s/* pages). Keep public/sw.js as it is.
- Test at 360px and 390px wide: no sideways scrolling.
```

**Check:**
- Open the published app link on your phone. iPhone: Share → Add to Home Screen. Android: Install.
- Open "Leads" from the home screen: it opens full-screen like an app.
- Turn on alerts there, then submit a test lead from a computer: your phone buzzes.

## Phase E: Connections
One-tap Instagram, Meta ads and Google.

### Prompt 15: one-tap connections
```
Build the Connections page, following SPEC.md ("Connections").

- "{n} of 3 connected" progress, then three big cards: Instagram, Meta ads, Google Business Profile. Before connecting: three benefit bullets and a big Connect button. After: the details for that provider (keywords and DM templates for Instagram; Pages with lead-form status, ad accounts and the ads link for Meta; Website button, reviews and 30-day stats for Google), when it was connected, last activity, and Disconnect.
- Connect calls supabase.functions.invoke('connect-start', { body: { studio_id, provider, return_to } }) and sends the browser to the returned url. On return, show a green banner for ?connected=… or a red one with the reason for ?connect_error=…, then clear the query.
- If the status function says a provider isn't set up yet (connect[provider] = false), show the button disabled with "Not set up yet".
- Disconnect with a confirmation → supabase.rpc('disconnect_account', …). needs_attention shows an amber box with the error and a Reconnect button.
- Google actions use supabase.functions.invoke('google-sync', { body: { studio_id, action } }) with action 'set-website' or 'refresh'.
- Also a Studio number card, and a collapsed "More options" section with tracking links, the lead intake URL and key (get_ingest_key, hidden until "Show key"), a "Send a test lead" button, Zapier and ManyChat steps, and a system check from the status function.
```

**Check:**
- The page shows three cards, each saying "Not set up yet" (correct until the Meta and Google apps are registered).
- More options → Send a test lead → it appears in your inbox with an alert.

## Phase F: Polish and launch
Final checks before the first studio goes live.

### Prompt 16: polish pass
```
Do a full polish pass across the studio page, dashboard and phone app:
- Check every screen at 360px, 768px and 1280px, in light and dark mode.
- Fix contrast to WCAG AA, visible focus rings, tap targets under 44px, text that overflows, and any sideways scrolling.
- Add loading skeletons and friendly empty states everywhere data loads.
- Add subtle motion only where it helps (quiz transitions, a new lead arriving), respecting prefers-reduced-motion.
- Make sure the studio's name, initials and accent colour come from the studio's config everywhere.
Then list anything you changed in src/engine or supabase, and why. (Ideally: nothing.)
```

**Check:**
- Click through everything once on your phone and once on a laptop.
- If Lovable changed src/engine or supabase, ask Claude to review the change before you keep it.

### Prompt 17: launch checklist
```
Help me go live, step by step, and wait for me after each step:
1. Publish the app on my custom domain (or the lovable.app address for now) and set the APP_URL and FUNCTIONS_URL secrets to the real addresses.
2. Twilio: tell me exactly which keys to copy into TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, and which two webhook URLs to paste on my Twilio number (twilio-inbound for messages, twilio-voice for calls).
3. Phone notifications: generate a VAPID key pair for me and fill in VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.
4. Email alerts (optional): RESEND_API_KEY and ALERT_FROM_EMAIL.
5. AI answers for Ava (optional): ANTHROPIC_API_KEY.
6. Run a full test: submit a lead on the studio page and confirm I get the alert, the lead gets the instant text, and replying from the lead page works.
```

**Check:**
- You receive a real text on your phone after submitting a test lead with your own number.
- Start Twilio's US business texting registration (A2P 10DLC) on day one. It takes one to three weeks.

## If Lovable goes off track

**Lovable rewrote logic it shouldn't have**
```
That change touched src/engine (or supabase). Undo it and do this again using the existing functions from src/engine without changing them.
```

**Something that worked is now broken**
```
After your last change, {thing} stopped working. Find what broke it and fix only that. Don't redesign anything else.
```

**The design drifted**
```
This screen doesn't match /styleguide. Rebuild it using only the components and colours from the style guide.
```

**A form stopped saving**
```
Submitting the form shows an error. Show me the exact error from submit_lead and fix the parameters to match SPEC.md. Don't change the database.
```

**It asks to change the database**
```
Don't change the tables or functions. Tell me what you need and why, and I'll check first.
```

**The consent line or Ava disclosure disappeared**
```
Put back the SMS consent line under every form button, and Ava's "virtual receptionist" introduction, exactly as in SPEC.md.
```
