Studio Funnel: a lead-to-booking system for permanent makeup (PMU) studios (brows, lip blush, lash line, corrections).

Three parts:
1) Studio page /s/:slug: the link in the studio's Instagram bio, Meta ads and Google profile. Match quiz, result with price, booking requests, free consults, "send me the price", questions, and Ava the receptionist chat.
2) Owner dashboard /dashboard: every lead from Instagram, Meta ads and Google in one inbox, with texting and Instagram DMs, callbacks, bookings, report, texting & alerts, one-tap connections, studio page settings.
3) Owner phone app /app: the same inbox as an installable PWA with lock-screen alerts.

Users: busy PMU artists (often solo owners) reading on a phone between clients. Their clients are mostly women 25–55, nervous about pain, looking fake, and healing.

RULES
- SPEC.md describes every screen's behaviour. Follow it.
- src/engine/* holds tested logic (quiz rules, receptionist answers, tracking, text templates, alerts, push). Import and use it. Don't rewrite or "simplify" it. Ask before changing it.
- supabase/migrations and supabase/functions are tested (119 automated checks). Don't change table names, columns, RPCs or function code unless I ask. Use the existing RPCs: get_public_studio, submit_lead, track_step, funnel_counts, get_ingest_key, disconnect_account, slug_available, create_studio.
- Visitors never read tables directly; they only use get_public_studio, submit_lead, track_step and the ava-chat function.
- Keep on every lead form: "By sending this you agree to get texts from {studio} about your enquiry. Msg & data rates may apply. Reply STOP to opt out."
- Ava always introduces herself as the studio's virtual (automated) receptionist. Health questions (pregnancy, allergies, skin conditions, medications, medical conditions) are answered word for word from the studio's own Health & safety FAQs (faqs with group 'health'), never by the AI and never as a personal diagnosis, always ending with 'confirm at a free consult / check with your doctor'. If the studio has no answer for that topic, the question goes to the owner.
- Only promise texts ("Check your texts") when studio.texting is true.
- public/sw.js, public/manifest.webmanifest and public/icons power the installable app. Keep them.

DESIGN
- Feel: calm, clean, expensive. A boutique clinic crossed with a skincare brand, not a SaaS template.
- Colours: warm neutrals (bone #F6F1EC, sand #E9DFD6, taupe #8C7B70), one deep mulberry accent (#7A2E48), sage for success (#5E7F68), amber for waiting. Soft shadows, rounded 16–20px cards, no gradients-as-decoration, no pure black.
- Type: Fraunces (headings), Manrope (UI). Generous line height.
- Per-studio accent colour from config later; build theme tokens so the accent can be swapped.
- Mobile-first. Tap targets ≥ 44px. No sideways scrolling at 360px. Visible focus. WCAG AA contrast. Light and dark mode. Respect prefers-reduced-motion.
- Studio page: one clear action per screen, sticky "Find my match" on mobile, before/after sliders, trust signals (licensed & insured, touch-up included, numbing used, healed photos).
- Owner side: quiet and scannable. Unread and waiting leads stand out; everything else recedes. The phone app feels like a messaging app.
- Use neutral placeholders for photos (never stock faces). The studio uploads its own later.
