# Studio Bloom

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

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b8dc401e-9f33-4deb-810e-313269667e1d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
