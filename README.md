# bethel803

**bethel803 is a group-first church small group care PWA** that brings devotional practice, prayer requests, Bible reading, attendance, Bible study, and leader dashboards into one operating flow.

> Built with React, TypeScript, Supabase, and Vercel.

This is not just a meeting management app. bethel803 was built as a real-world community care tool: leaders can remember and follow the spiritual rhythms of their group, while members can leave daily devotional, prayer, Bible reading, and study responses with less friction.

The project combines three things: a service used by a real community, a record of product and architecture decisions, and a portfolio artifact. Its public goal is not mass growth for its own sake, but to show how a small, repeatable care workflow can be designed, shipped, operated, and improved.

## Preview

| Leader Dashboard | Devotional / Prayer Flow | Bible Study / Attendance |
| --- | --- | --- |
| <img src="./docs/assets/readme/screenshot-dashboard.png" alt="Leader dashboard" width="260"> | <img src="./docs/assets/readme/screenshot-devotional.png" alt="Deep devotional and prayer flow" width="260"> | <img src="./docs/assets/readme/screenshot-study-attendance.png" alt="Bible study response screen" width="260"> |

The README images use sample or privacy-safe screens with sensitive information removed.

## Links

These links are curated for public GitHub visitors. The detailed documents remain mostly bilingual or Korean-first because bethel803 was designed and operated for Korean church small groups.

| Area | Link | Public context |
| --- | --- | --- |
| Demo | [Limited public demo](https://project-9zxj4.vercel.app/) | A limited public build for previewing the service shape. |
| Service Overview | [Current service overview](./docs/기능설계/01_서비스개요_현재구현.md) | Explains what the service currently does and who it serves. |
| Core Features | [Core feature design](./docs/기능설계/02_핵심업무기능.md) | Describes devotional, prayer, Bible study, attendance, and dashboard flows. |
| Data Architecture | [Data architecture](./docs/기능설계/04_데이터_아키텍처.md) | Summarizes the main data model and Supabase/Postgres boundaries. |
| Group-First Architecture | [Group-first architecture redesign](./docs/기능설계/모임우선_아키텍처_재설계.md) | Records the product decision to center groups before church-level administration. |
| Operations | [Operations guide](./docs/OPERATIONS.md) | Covers deployment, Supabase operations, scheduled jobs, and production-care notes. |
| Public Hygiene | [Public repository hygiene report](./EXPOSURE_REPORT.md) | Documents the repository review performed before public exposure. |

## Tech Stack

React, TypeScript, Vite, Tailwind CSS, shadcn-ui, TanStack Query, Supabase Auth, PostgreSQL, RLS, Storage, Edge Functions, Web Push, PWA, Vercel

## Project Direction

The identity of this project has three layers.

- **Ministry and care**: It helps small groups remember, encourage, and care for one another.
- **Portfolio**: It records the process of designing, building, operating, and improving a product with real users.
- **Motivation engine**: It values sustained usage and meaningful records more than raw feature count or signup volume.

This project is not primarily optimized for revenue, scale, or aggressive user acquisition. Its public purpose is to preserve the build log, product judgment, and architecture decisions behind a real service.

## Product Perspective

The primary user is the small group leader.

Leaders need a clear view of members' spiritual practices and care signals. Members need a lightweight way to keep daily devotional, prayer, Bible reading, and study records. When adding new features, the guiding question is not only "Will users open this more often?" but "Will this help an existing group care for one another more deeply?"

## Core Features

- **Devotional and prayer flow**: Daily devotional content, prayer, completion records, and leader visibility
- **Bible study**: Weekly passages, questions, answers, and admin preparation flow
- **Prayer requests**: Personal prayer requests, answered prayers, and intercessory prayer participation
- **Bible reading**: Reading logs, plans, bookmarks, and statistics
- **Schedule and attendance**: Group events, attendance responses, and attachment management
- **Leader dashboard**: Member activity, weekly reports, and CSV exports
- **Notifications and search**: In-app notifications, web push, and global search
- **Operations automation**: Devotional fetching, bulletin PDF parsing, weekly reporting, and Edge Function jobs

## Architecture

bethel803 is a multi-tenant React PWA.

```text
React / TypeScript / Vite
        |
TanStack Query + Supabase JS
        |
Supabase Auth / Postgres / RLS / Storage / Edge Functions
        |
Vercel + Supabase cron / Edge automation
```

The core design principle is **Group-First Architecture**.

- Regular users enter through a "create or join a group" flow rather than a church-registration-first flow.
- Church-level administration is treated as a rarer super-admin operation.
- Data isolation is enforced through Supabase RLS and scoped by `church_id` and `district_id`.
- Free community groups can share a common container while each leader is restricted to their own group.

## Local Development

```bash
npm install
npm run dev
```

Default development URL:

```text
http://localhost:8080
```

Create `.env.local` from `.env.example`. Only public frontend values with the `VITE_` prefix should be placed in the frontend environment.

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_APP_URL=http://localhost:8080
VITE_VAPID_PUBLIC_KEY=
VITE_APP_VERSION=local-dev
```

Notes:

- Do not put the Supabase `service_role` key in frontend environment variables.
- `OPENAI_API_KEY` should be managed only as a Supabase Edge Function secret.
- Production data checks should be read-oriented unless an operations procedure explicitly says otherwise.

## Verification

```bash
npm test
npm run build
```

Even for small changes, check the repository with public hygiene in mind.

- Do not commit real names, phone numbers, email addresses, passwords, tokens, or third-party UUIDs.
- Use role-based sample names such as `Member A`, `Leader A`, or `Tester A`.
- Before committing, assume any document may be viewed through a public GitHub permalink.

## Deployment and Operations

- The frontend is deployed to Vercel Production from `main`.
- Supabase migrations and Edge Functions are applied through separate operations procedures.
- Automation jobs are managed through Supabase Edge Functions and cron-based flows.

Key automation:

- `fetch-devotional`: Fetches and stores devotional content
- `parse-bulletin`: Parses bulletin PDFs
- `push-dispatch`: Sends web push notifications
- `compute_weekly_report()`: Closes and computes weekly reports

## Documentation

- [Service Overview](./docs/기능설계/01_서비스개요_현재구현.md)
- [Core Features](./docs/기능설계/02_핵심업무기능.md)
- [Data Architecture](./docs/기능설계/04_데이터_아키텍처.md)
- [Group-First Architecture](./docs/기능설계/모임우선_아키텍처_재설계.md)
- [Operations Guide](./docs/OPERATIONS.md)
- [Public Repository Hygiene Report](./EXPOSURE_REPORT.md)

## License

This repository is public for portfolio, review, and learning purposes, but it is not currently released under an open-source license.

Unless a license is added later, all rights are reserved. Please do not reuse, redistribute, or commercialize the source code without permission.

## Current Status

Most core features are implemented. The current priority is less about adding more features and more about improving the quality of repeated real-world usage.

- Strengthening dashboards that show depth of use among existing users
- Refining flows that are repeatedly used in real group operations
- Improving PWA stability, notifications, and automation reliability
- Preserving build logs and product decision records

This project will continue to evolve around small, concrete, real-world usage.
