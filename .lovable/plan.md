# Studio Funnel foundation

## Build
- Replace the starter styling with Studio Funnel’s warm bone, sand, taupe, mulberry, sage, amber, and ink semantic theme tokens, including a coordinated dark theme and swappable studio accent variables.
- Load Fraunces for headings and Manrope for interface text, with mobile-first spacing, soft shadows, 16–20px surfaces, and accessible 44px controls.
- Add reusable shadcn-style primitives for buttons, cards, chips, source and status badges, fields, switches, sheets, toasts, avatars, empty states, stat tiles, and a before/after slider.
- Build a polished `/styleguide` showing every component, state, and theme treatment.
- Add simple branded shells for `/`, studio, authentication, onboarding, dashboard, and app routes, including all requested dynamic URL variants.
- Add unique metadata to each content route and preserve the generated TanStack route tree workflow.

## Technical details
- Keep colors and shadows in `src/styles.css` as semantic Tailwind v4 tokens; components will not hardcode palette values.
- Use Radix primitives already installed for accessible switch, sheet, and avatar behavior; use Sonner for toast behavior.
- Group repeated placeholder pages through shared shell components while keeping one route file per requested route shape.
- Verify the style guide and representative dynamic routes in desktop and mobile-sized browser views, then check the latest preview build diagnostics.
