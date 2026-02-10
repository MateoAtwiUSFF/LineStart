# CLAUDE.md — LineStart MVP

## What This Project Is
LineStart is a web-based production scheduling system for manufacturing environments. Production Managers assign jobs to resources (machines/workstations). Resource Operators execute work, track time, and report disruptions. Built as an internal company tool.

Full spec: `docs/SPEC.md`
Design decisions: `docs/DESIGN_DECISIONS.md`
Future features (do not build): `docs/FUTURE_FEATURES.md`

---

## Tech Stack — Do Not Deviate

- **Framework**: SvelteKit with Svelte 5
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS — utility classes only, no custom CSS files unless absolutely necessary
- **Components**: All UI components are hand-built in Svelte. No component libraries. No AG-Grid. No ECharts. No Chart.js. No external UI dependencies. Data grids, Gantt charts, modals, and all interactive elements are built from scratch using native HTML, CSS (via Tailwind), and JavaScript within Svelte components.
- **State Management**: Svelte writable/readable stores in `src/lib/stores/`
- **Backend**: Firebase (Firestore, Auth, Cloud Functions, Hosting, FCM)
- **Database**: Firestore (NoSQL document database)
- **Auth**: Firebase Auth — Google Sign-In only. No email/password.
- **Functions**: Firebase Cloud Functions (Node.js)
- **Notifications**: Firebase Cloud Messaging (FCM) for push alerts
- **Package Manager**: npm
- **Build**: Vite (via SvelteKit)

---

## Svelte Rules

- **Svelte 5 only.** Use runes for all reactivity. Do not use Svelte 4 legacy syntax.
- Use `$state()` for reactive variables. Do not use `let` with `$:` reactive declarations.
- Use `$derived()` for computed values. Do not use `$:` reactive statements.
- Use `$effect()` for side effects. Do not use `$:` for side effects.
- Use `$props()` for component props. Do not use `export let`.
- Use `$bindable()` for two-way bindable props when needed.
- Use `onclick`, `onchange`, etc. as element attributes. Do not use `on:click`, `on:change` directive syntax.
- Use `{#snippet}` and `{@render}` for reusable markup blocks. Do not use `<slot>`.
- Use `{#if}`, `{#each}`, `{#await}` blocks. No external conditional rendering libraries.
- Use `onMount`, `onDestroy` from `svelte` for lifecycle when `$effect` is not appropriate.
- Use Svelte transitions and animations from `svelte/transition` when needed.
- Keep components focused. If a component exceeds ~200 lines, split it.
- All `.svelte` files use runes mode by default. Do not add `runes: true` — it is the default in Svelte 5.

---

## File Structure

```
src/
├── routes/
│   ├── login/+page.svelte
│   ├── production-queue/+page.svelte
│   ├── resources/+page.svelte
│   ├── resources/[resourceId]/+page.svelte
│   ├── gantt/+page.svelte
│   ├── resource-config/+page.svelte
│   └── users/+page.svelte
├── lib/
│   ├── types/index.ts              — All TypeScript interfaces and enums
│   ├── firebase.ts                 — Firebase app initialization
│   ├── stores/
│   │   ├── auth.ts                 — Auth state and user role
│   │   ├── config.ts               — Production Queue configuration
│   │   ├── jobs.ts                 — Jobs and work orders
│   │   └── resources.ts            — Resources and assignments
│   ├── utils/
│   │   ├── calculations.ts         — Duration formula and time helpers
│   │   ├── firestore.ts            — All Firestore CRUD operations
│   │   ├── csv.ts                  — CSV import/export logic
│   │   └── notifications.ts        — FCM token and notification helpers
│   └── components/
│       ├── NavBar.svelte
│       ├── LoginForm.svelte
│       ├── pq/                     — Production Queue components
│       ├── resources/              — Resource List components
│       ├── resource/               — Individual Resource Page components
│       ├── gantt/                   — Gantt Chart components
│       ├── config/                 — Resource Configuration components
│       └── users/                  — User Management components
functions/
├── src/index.ts                    — All Cloud Functions
└── package.json
docs/
├── SPEC.md
├── DESIGN_DECISIONS.md
└── FUTURE_FEATURES.md
```

**Rules:**
- New components go in `src/lib/components/{feature}/ComponentName.svelte`
- New utility functions go in the appropriate file in `src/lib/utils/`
- New types go in `src/lib/types/index.ts`
- New stores go in `src/lib/stores/`
- Route pages are thin — they import components and pass data. Business logic lives in utils and stores.
- Do not create files outside this structure without asking.

---

## Naming Conventions

- **Components**: PascalCase — `ResourceCard.svelte`, `AddJobModal.svelte`
- **Files (non-component)**: camelCase — `firestore.ts`, `calculations.ts`
- **Functions**: camelCase — `calculateDuration()`, `fetchJobsByResource()`
- **Variables**: camelCase — `workOrderId`, `scheduledStart`
- **TypeScript interfaces**: PascalCase, no prefix — `Job`, `Resource`, `WorkOrder`, `AuditLogEntry`
- **TypeScript enums**: PascalCase — `UserRole`, `JobStatus`, `WorkOrderStatus`
- **Firestore collections**: camelCase — `jobs`, `resources`, `auditLogs`, `ganttEntries`
- **Routes**: kebab-case — `production-queue`, `resource-config`
- **CSS/Tailwind**: Use Tailwind utility classes. No custom class names unless wrapping a complex reusable pattern.

---

## Firebase Patterns

### General
- All Firestore operations go through `src/lib/utils/firestore.ts`. Components never call Firestore directly.
- Use subcollections (not maps or arrays) for one-to-many relationships.
- Manual refresh model — do not use Firestore `onSnapshot` real-time listeners. Fetch data on page load and on explicit user action (button click, form submit). FCM handles urgent notifications.
- Always include `createdBy`, `createdAt`, `modifiedBy`, `modifiedAt` on documents that support it.

### Collections
- `/users` — user accounts with role
- `/resources` — machines/workstations
- `/resources/{id}/assignedWorkOrders` — subcollection of WO references (not a map on the resource doc)
- `/resources/{id}/scheduledDowntime` — planned maintenance windows
- `/jobs` — production jobs
- `/jobs/{id}/workOrders` — work orders for a job
- `/jobs/{id}/workOrders/{id}/timeEntries` — time tracking per WO
- `/jobs/{id}/auditLog` — references to global audit entries
- `/auditLogs` — global append-only audit log
- `/ganttEntries` — denormalized collection for Gantt chart rendering
- `/configuration/productionQueue` — custom fields and status definitions
- `/configuration/system` — system-wide settings

### Security Model
- All routes require authentication.
- User must have a `/users` document to access the app. No document = Access Denied screen.
- Roles: `admin`, `pm`, `ro`
- Admin: full access to everything.
- PM: full access to jobs, resources, config. Can create RO users only.
- RO: read-only on Production Queue and Resource Config. Full action access on Resource Pages (start/pause/complete WOs, report downtime). Write access limited to specific fields on work orders and the `currentDowntime` field on resources.
- Audit logs are append-only. No role can update or delete audit entries.

---

## Critical Business Logic

### Duration Formula
```
estimatedDuration = setupTime + (quantity / defaultProductionRate)
```
- `setupTime` is in minutes
- `defaultProductionRate` is units per hour
- Result is in minutes
- Calculated when a work order is created, based on the assigned resource's settings
- Example: 15 min setup + (100 units / 30 units per hour) = 15 + 200 = 215 minutes

### Job Statuses (MVP — four fixed states only)
- `unassigned` — job created, no resource assigned
- `assigned` — at least one work order exists
- `in_progress` — at least one work order is active
- `finished` — all quantity completed

### Work Order Statuses
- `queued` — assigned to resource, waiting
- `active` — operator is working on it
- `paused` — operator paused work
- `completed` — full quantity done
- `partial` — some quantity done, remainder returns to queue

### Multiple Active Work Orders
- An operator can have multiple WOs active simultaneously on the same resource.
- Each active WO tracks its own time entries independently.
- The UI shows all active WOs in the Current Work section.

### Partial Completion
- When an operator completes a WO with less than the target quantity:
  - Original WO status → `partial`, actual quantity recorded
  - System creates a NEW work order under the same job for the remaining quantity
  - New WO has status `queued`, no resource assignment
  - New WO returns to Production Queue for PM to assign

### Downtime — Continuous Push
- Unscheduled downtime continuously pushes the timeline as long as the resource is marked down.
- It is the PM's responsibility to redistribute work orders if the machine won't return in time.
- Clearing downtime stops the push. Remaining WOs proceed from their pushed positions.

### Gantt Entries
- `/ganttEntries` is a denormalized top-level collection maintained by Cloud Functions.
- Each document = one bar on the Gantt chart.
- Updated whenever a work order is created, modified, or deleted.
- The Gantt page queries this single collection filtered by date range — it does not crawl subcollections.

### Audit Trail
- Every state-changing action on a job or work order writes to `/auditLogs`.
- A reference is also created in `/jobs/{id}/auditLog`.
- Entries are immutable. Never update or delete an audit log entry.
- Record: userId, action, timestamp, jobId, workOrderId (if applicable), oldValue, newValue.

---

## Auth Flow
1. User clicks Google Sign-In.
2. Firebase Auth returns UID and email.
3. App checks for a `/users` document matching that UID.
4. If no document exists → show Access Denied screen. Do not create a user record.
5. If document exists → read role, route to appropriate page:
   - `admin` or `pm` → `/production-queue`
   - `ro` → `/resources`

---

## Priority System (MVP)
- No UI controls for setting or changing priority in MVP.
- All work orders default to `normal` priority.
- The priority field exists in the data model for future use.
- Do not build priority sorting, filtering, or visual indicators unless specifically asked.

---

## What Not to Build
Before implementing any feature, check `docs/FUTURE_FEATURES.md`. The following are explicitly deferred:
- Multi-step workflows (job routing through sequential resources)
- AI suggestions or predictions
- Drag-and-drop Gantt editing
- Real-time Firestore listeners
- Mobile responsive design
- Custom resource actions
- Resource capability matching
- Priority controls and queue reordering
- Resource-operator access restrictions (all ROs can access all resources in MVP)

If a task seems to require one of these features, stop and ask before implementing.

---

## Deployment

**IMPORTANT: Only deploy to Firebase when explicitly instructed to do so.**

Do not run `firebase deploy` commands unless the user specifically requests deployment. This includes:
- `firebase deploy --only hosting`
- `firebase deploy --only functions`
- `firebase deploy --only firestore:rules`
- `firebase deploy` (full deployment)

Always build and test locally first. Wait for explicit user approval before deploying to production.
