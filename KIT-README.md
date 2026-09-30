# Studio Funnel: Lovable starter kit

Everything already built and tested, ready to drop into a new Lovable project:

| In the kit | What it is |
|---|---|
| `PROMPTS.md` | The step-by-step prompts to paste into Lovable, in order |
| `KNOWLEDGE.md` | Paste into Lovable → Project settings → Knowledge |
| `SPEC.md` | What every screen does (Lovable reads this) |
| `src/engine/` | Quiz rules, receptionist answers, tracking, text templates, alerts, push |
| `supabase/migrations/` | Database: tables, security rules, sign-up (run in order 0001 → 0004) |
| `supabase/functions/` | Server: texting, alerts, follow-ups, missed calls, Instagram / Meta / Google connections |
| `public/` | Installable-app files: service worker, manifest, icons |
| `tests/` | 119 automated checks for the server logic (`bun tests/server-messaging.test.ts`) |

Start with `PROMPTS.md`, step 1.
