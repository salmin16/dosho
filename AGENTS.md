# AGENTS.md

Guidance for AI agents and developers working on **MineConnect**, a Tanzanian mining opportunity
marketplace (TanStack Start on Netlify).

**Continue from [PLAN.md](./PLAN.md).** Milestone 1 (product surface) is complete; the next milestone
is the data model and real listings.

## Architecture

- TanStack Start (React 19, TanStack Router file routes, SSR), Vite 7, Tailwind CSS 4, TypeScript strict
  (`noUnusedLocals` / `noUnusedParameters` are on).
- No backend yet. Every screen reads from **`src/data/fixtures.ts`** — the single stub module. When
  adding persistence, replace these reads with server functions / route loaders backed by Netlify
  Database (Drizzle, schema in `db/schema.ts`) and keep the exported types as the contract.
- Forms (enquiry, due diligence, report, quote, list-a-project) validate client-side and show success
  states with generated reference numbers; they do not persist yet.
- Saved projects use localStorage via `src/lib/saved.ts` until accounts exist.

## Key directories

```
src/
  data/fixtures.ts        # Projects, verification levels, providers, plans, pricing, stats (stub data)
  lib/img.ts              # Netlify Image CDN URL helpers — always use these for /public/img assets
  lib/saved.ts            # useSavedProjects() localStorage hook
  components/
    Header.tsx            # Fixed header; transparent overlay on "/" only (set in __root.tsx)
    Footer.tsx            # Footer with legal links and regulatory notice
    ProjectCard.tsx       # Listing card (grid / row layouts)
    VerificationBadge.tsx # L0–L4 badge + levelTone() colours
    TanzaniaMap.tsx       # Stylised SVG map (simplified border, lng/lat projection) + MapLegend
  routes/
    __root.tsx            # Document shell, fonts, meta, Header/Footer chrome
    index.tsx             # Home page
    opportunities.tsx     # Marketplace; filters live in validated URL search params
    opportunities_.$projectId.tsx  # Project detail (non-nested route) + action modals
    map.tsx, list-a-project.tsx, services.tsx, verification.tsx, pricing.tsx, faq.tsx
public/img/               # AI-generated photography (served via Image CDN, never directly)
```

## Design system

Tokens are in `src/styles.css` (`@theme`): `ink` (basalt dark), `paper` (warm cream), `ochre`
(laterite/copper accent), `gold`, `moss` (verified), `stone` (muted text). Display font is Fraunces
(`font-display`), body Instrument Sans, data/labels JetBrains Mono (`.eyebrow`, `.label`). Shared
utility classes: `.btn-primary`, `.btn-ghost`, `.field`, `.label`, `.eyebrow`, `.contours`, `.grain`.
Pages offset the fixed header with `pt-[72px]`.

## Non-obvious rules (product/legal)

- Never imply MineConnect is a licensing authority, that a listing equals licence approval or
  transferability, or that minerals/grade/profit are guaranteed. Keep disclaimers on listing pages.
- Every listing shows an opportunity type **and** a transaction status.
- Verification badges must show what was checked, by whom, when, and what was not verified.
- Platform fees are always labelled separately from government fees; prices are in TSh, project
  investment figures in US$.
- Collect minimal personal data (PDPA 2022); record consent on forms.
