# EduPath — Front-End Scaffold

Production-style React front end for the AI-Powered International Student Recruitment, Application & Commission Platform (see `Developer_and_AI_Agent_Master_Instruction_v4.docx`). This covers **all role experiences** from the spec in one codebase: Student, B2B Agent, and the five Staff web workspaces (Counsellor, Admission, Compliance, Data Management, Finance), plus Admin.

## Stack

- **Vite + React 19 + TypeScript** — strict mode, `tsc -b` runs as part of `npm run build`
- **React Router v7** — client-side routing, one route tree, role-scoped nav
- **Tailwind CSS v4** — utility classes, brand tokens defined in `src/index.css`
- **lucide-react** — icon set

There is no backend yet — everything reads from `src/data/mockData.ts`, which is structured to mirror the entities in Section 21 (Database Architecture) of the spec: Students, Applications, Documents, Commission Transactions, Compliance Cases, Catalog Records, Workflow Templates, Audit Log.

## Running it

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
npm run build     # type-checks with tsc -b, then builds with vite
```

## How it's organized

```
src/
  components/ui/       shared design system: Card, Badge/StatusBadge, ProgressBar,
                        Table, Button, Avatar, StatTile, PageHeader, EmptyState
  context/RoleContext  demo-only role switcher (persisted to localStorage) —
                        replace with real auth/session once a backend exists
  layouts/AppLayout     sidebar + topbar shell, nav items driven by layouts/nav.ts
  data/mockData.ts      mock entities + the ROLES list
  types/                shared TypeScript types (Role, Application, DocumentItem, …)
  features/
    student/            Dashboard, Applications, ApplicationDetail, Documents,
                         UniversitySearch, Messages, Profile
    agent/               Dashboard, Students, Applications, Commissions, Statements
    staff/
      counsellor/        CaseQueue
      admission/          SubmissionQueue
      compliance/         RiskQueue (flag / freeze / clear — no financial or academic edit)
      data/                Catalog (draft → review → publish workflow)
      finance/             CommissionApprovals
    admin/               UsersRoles, WorkflowTemplates, CommissionRules, AuditLogs
```

There's no dedicated role/auth guard on routes yet — the top-right role switcher in `AppLayout` is a **demo convenience** so you can preview every workspace without a login flow. When a real identity service exists (Section 6 of the spec), replace `RoleContext` with the authenticated session and add route guards so a Compliance officer can't navigate to `/staff/data`, etc.

## What's deliberately not wired up

Everything here is presentation-layer against mock data — no API calls, no auth, no persistence beyond `localStorage` for the role switcher. Before this is real:

- Add an API client (`fetch`/`axios` + React Query or similar) and replace the `data/mockData.ts` reads in each feature file with real queries.
- Add auth (Section 6): central identity service, MFA for staff, and **server-side** permission checks — the front end should never be the only enforcement point.
- Add the maker-checker UI flow for Compliance freezes and Data Management publishes (the Catalog edit form here is a placeholder for that).
- Split this into the actual deployment targets described in the spec: Student ships as a Flutter mobile app (this is a responsive web stand-in for design/dev purposes), Agent and Staff/Admin stay as this React web app.

## Design tokens

Brand colors live as CSS variables in `src/index.css` (`--brand-500` etc.) so they're easy to swap without touching component code. Status colors (`Badge`/`StatusBadge` in `components/ui`) are keyword-matched off the status string (e.g. "paid", "flagged", "compliance hold") — centralize this against the real enum values once the backend defines them.
