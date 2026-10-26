# MineConnect

**Discover. Verify. Connect.** — a mining opportunity marketplace and intelligence platform for
Tanzania, connecting small- and medium-scale miners and mineral-right holders with investors, mining
companies, technical professionals and service providers.

This repository contains the first milestone: the complete, clickable product surface running on
illustrative pilot data.

## Screens

| Route | Screen |
| --- | --- |
| `/` | Home — hero search, featured opportunities, how it works, verification ladder, map, services, trust & safety |
| `/opportunities` | Marketplace with filters, sorting and grid / list / map views |
| `/opportunities/:id` | Project detail with verification scope, documents, enquiry / due-diligence / report flows |
| `/map` | Mining intelligence map of Tanzania |
| `/list-a-project` | Six-step project submission wizard |
| `/services` | Mining services directory with quote requests |
| `/verification` | Verification framework (Levels 0–4) |
| `/pricing` | Memberships and listing / service fees (TSh) |
| `/faq` | Help centre |

## Tech

- [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, SSR) on Netlify
- Tailwind CSS 4, Lucide icons, Google Fonts (Fraunces, Instrument Sans, JetBrains Mono)
- Netlify Image CDN for all imagery (`/.netlify/images`)

## Run locally

```bash
pnpm install
netlify dev   # or: pnpm dev
```

## Roadmap

All data currently comes from `src/data/fixtures.ts`. Next up: the database model and real listings,
accounts and KYC, moderation and verification workflows, enquiries with commission protection, admin,
billing and notifications, deal rooms and a full GIS map. See [PLAN.md](./PLAN.md).
