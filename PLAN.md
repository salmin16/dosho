# MineConnect — Product Roadmap

MineConnect is a Tanzanian mining opportunity marketplace and intelligence platform (see the master
specification). The roadmap is staged so every milestone ships something usable, starting from the
visible product and moving toward the data, trust and transaction layers.

## Milestone 1 — Product surface ✅ (complete)
Branded, responsive, clickable product built on stubbed data in `src/data/fixtures.ts`.
- Home page following the spec’s structure (hero search, featured listings, workflows, verification
  ladder, map teaser, audiences, services, trust & safety, insights, legal footer)
- Opportunities marketplace with filters (mineral, region, type, stage, licence, verification, ticket
  size, saved), sorting and grid / list / map views — state kept in the URL
- Project detail page (spec §25) with licence info, evidence, infrastructure, documents with access
  levels, verification scope (checked / not verified), enquiry, due-diligence and report-listing flows
- Intelligence map, list-a-project wizard (6 steps), services directory with quote requests,
  verification framework, pricing, FAQ
- Saved projects persist in localStorage (temporary, until accounts exist)

## Milestone 2 — Data model & real listings
- Netlify Database (Postgres + Drizzle) schema for Projects, ProjectLocations, MineralTypes,
  LicenceRecords, ProjectDocuments, VerificationCases/Checks, ServiceProviders, Enquiries, AuditLogs
- Seed with the 20–50 pilot records; swap `fixtures.ts` reads for server functions / loaders
- Server-side search & filtering with pagination

## Milestone 3 — Accounts, roles & KYC
- Netlify Identity: register / login / password recovery
- Roles: Visitor, Registered User, Project Owner, Investor, Service Provider, Verifier, Moderator,
  Finance Officer, Super Admin (RBAC on routes and server functions; MFA for admins)
- Individual / company KYC profiles with minimal data, consent records and retention rules (PDPA 2022)
- User, project-owner and investor dashboards; saved projects & saved searches move to the database

## Milestone 4 — Submission, moderation & verification workflow
- Persist the list-a-project wizard; private document uploads to Netlify Blobs (signed access only)
- Moderation queue, duplicate detection, prohibited-claims flagging, report-listing handling
- Verification cases with checks, evidence, verifier role, dates, expiry and auditable badge history

## Milestone 5 — Enquiries & commission protection
- Persisted enquiries with recorded introductions and acceptance of facilitation terms before contact
  details are released; full audit trail (who introduced whom, when, project & enquiry IDs)
- Service-provider quote requests and moderated ratings

## Milestone 6 — Admin & compliance dashboard
- KPIs, pending KYC / listings, verification queue, flagged content, complaints, audit logs, user roles,
  CMS for FAQs and insights

## Milestone 7 — Memberships, billing & notifications
- Plans and entitlements (Explorer, Miner, Professional, Investor, Corporate)
- Invoices, payment references, receipts, refunds, reconciliation; bank transfer + approved mobile money
- Email / SMS / WhatsApp notifications (enquiries, approvals, renewals, receipts, verification expiry)

## Milestone 8 — Deal rooms (Phase 2)
- Private workspaces: permissions, document folders & versions, watermarking, NDA status, Q&A,
  due-diligence checklist, milestones, activity log, commission agreement reference, exportable summary

## Milestone 9 — GIS & intelligence (Phase 2–3)
- Real GIS map (MapLibre/OpenStreetMap or licensed provider), clustering, saved areas, legally sourced
  context layers clearly labelled as authoritative vs user-submitted
- Investor matching, alerts, analytics, data subscriptions, Swahili localisation

## Before public launch
Legal review (Mining Act, 2025 Mineral Rights Amendment Regulations, PDPA 2022), lawyer-reviewed terms
and policies, brand/domain check, security testing and a controlled pilot.
