<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project architecture

- Studio Funnel visual roles are semantic Tailwind v4 tokens in `src/styles.css` so each studio can swap the accent without component changes.
- Shared PMU-facing primitives and placeholder shells live in `src/components/studio-funnel.tsx` to keep route files presentation-only.
