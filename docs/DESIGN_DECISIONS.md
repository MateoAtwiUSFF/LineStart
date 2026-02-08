# Design Decisions — LineStart MVP

This document records decisions made during the technical review process. Each decision has been confirmed by the product owner and is reflected in the current SPEC.md. This document serves as the rationale record — consult it when you need to understand *why* something is designed a certain way.

---

## Decision 1: Duration Formula Correction

**Question**: The original formula `setupTime + (quantity * defaultProductionRate)` produces incorrect results when `defaultProductionRate` is units per hour — more throughput would mean longer duration.

**Decision**: Corrected to `setupTime + (quantity / defaultProductionRate)`. Setup time is in minutes, production rate is units per hour, result is in minutes.

**Example**: 15 min setup + (100 units / 30 units per hour) = 15 + 200 = 215 minutes.

---

## Decision 2: Assigned Work Orders — Map to Subcollection

**Question**: Storing assigned work orders as a map on the resource document creates write contention when multiple WOs are assigned in quick succession. At what scale does this become a problem?

**Decision**: Replace the map with a subcollection at `/resources/{id}/assignedWorkOrders/{workOrderId}`. This eliminates write contention entirely and also enables querying assigned WOs for Gantt rendering without loading the full resource document. Each document in the subcollection stores: workOrderId, jobId, position, addedAt.

---

## Decision 3: Partial Completion Creates New Work Order

**Question**: When an operator completes less than the target quantity, does the PM manually create a new work order, or does the system auto-generate one?

**Decision**: The system automatically creates a new work order for the remaining quantity. The original WO is marked `partial` with the actual completed quantity. The new WO is created with status `queued`, no resource assignment, and quantity equal to the original target minus the completed amount. It returns to the Production Queue for the PM to assign. Both the partial completion and the new WO creation are logged in the audit trail.

---

## Decision 4: Multiple Active Work Orders Per Resource

**Question**: Can an operator only have one active WO at a time, or can they run multiple simultaneously?

**Decision**: Operators can have multiple WOs active at the same time on the same resource. This supports scenarios where ROs work on similar jobs simultaneously. Each active WO tracks its own time entries independently. The Resource Page UI shows all active WOs in a Current Work section rather than a single-job display.

---

## Decision 5: Continuous Downtime Timeline Push

**Question**: When unscheduled downtime pushes WOs by 30 minutes, is that a one-time shift or does it continue? What about WOs pushed past operational hours?

**Decision**: Downtime is not a one-time push. As long as a resource is marked as down, the timeline continuously extends. It is the PM's responsibility to monitor downtime duration and redistribute work orders to other resources if the machine will not return in time. When downtime is cleared, the push stops and remaining WOs proceed from their current positions. Overflow past operational hours is a PM judgment call — the system does not auto-redistribute.

---

## Decision 6: Simplified Job Status for MVP

**Question**: How is a job's top-level status determined when it can have multiple work orders in different states?

**Decision**: MVP uses four fixed states: `unassigned`, `assigned`, `in_progress`, `finished`. Complex status derivation from work order aggregation is deferred to a future release. The status transitions are straightforward: no WOs = unassigned, any WO exists = assigned, any WO active = in_progress, all quantity fulfilled = finished.

---

## Decision 7: User Pre-Registration Required

**Question**: How does the user creation flow work? Does Google sign-in happen first, or does the admin create the record first?

**Decision**: Admins must create a `/users` document (with email, name, and role) before a user can access the system. When someone authenticates via Google, the app checks for a matching `/users` document. If none exists, they see an Access Denied screen and cannot proceed. This is an internal company tool — no self-registration.

---

## Decision 8: Priority Controls Deferred

**Question**: How is queue ordering controlled on the Resource Page? Is position manually set by the PM?

**Decision**: MVP will not include any UI controls for setting or changing work order priority. All work orders default to `normal` priority. The priority field exists in the data model for future use. Priority-based ordering, manual queue reordering by PMs, and priority visual indicators are all deferred to a future release. Queue ordering in MVP is by position (chronological assignment order).

---

## Decision 9: Resource-Operator Access (Open in MVP)

**Question**: Can any RO access any resource, or is there an implicit binding?

**Decision**: In the MVP, all ROs can access all Resource Pages. There are no per-resource access restrictions. Future versions will add resource-operator access management and potentially an operator training/certification tracking system.

---

## Decision 10: Firestore Security Rule Tightening

**Question**: The original security rules allowed ROs to update any field on work orders. Should this be restricted?

**Decision**: Yes. RO updates on work orders are restricted via `affectedKeys()` to only: `status`, `quantityCompleted`, `startedBy`, `startedAt`, `completedBy`, `completedAt`. This prevents operators from modifying priority, resourceId, assignedBy, or other PM-controlled fields. Additionally: audit logs are strictly append-only (no update/delete for any role), PM user updates cannot escalate an RO to PM or Admin, and `/ganttEntries` is write-protected at the rules level (only Cloud Functions via Admin SDK can write).

---

## Decision 11: Gantt Data Strategy

**Question**: Should the Gantt chart query Firestore subcollections directly, or use a different approach?

**Decision**: A denormalized `/ganttEntries` top-level collection is maintained by Cloud Functions. Each document represents one bar on the Gantt chart with all display-relevant fields. The Gantt page runs a single collection query filtered by date range instead of crawling nested subcollections. Cloud Functions update this collection on every work order create/update/delete. The small write overhead per WO change is far cheaper than the read overhead of assembling Gantt data from subcollections on every page load.

---

## Decision 12: FCM as Notification Strategy

**Question**: What is FCM and why use it instead of real-time listeners?

**Decision**: Firebase Cloud Messaging sends push notifications from the server to the user's browser without real-time database listeners. This is dramatically cheaper than `onSnapshot` listeners at scale. FCM tokens are requested at login and stored in `/users`. If a token expires, the notification fails silently and the user sees updates on next manual refresh. MVP notification triggers: WO assigned (notify ROs), downtime reported (notify PMs), downtime cleared (notify PMs), WO completed (notify assigning PM).

---

## Decision 13: Firebase as Platform

**Question**: Does Firebase create limitations for this project?

**Decision**: Firebase is the right choice for MVP despite real constraints. Key limitations acknowledged: no relational queries (mitigated by denormalization), cost scales with reads (mitigated by pagination and smart caching), no server-side aggregation (mitigated by denormalized counters), limited complex filtering (mitigated by client-side filtering where needed), narrow migration path to relational databases. None of these block the MVP. Re-evaluation point: after MVP is in use with real data on query patterns and user volume.

---

## Decision 14: Pure Svelte Components

**Question**: What UI libraries should be used for the data grid and Gantt chart?

**Decision**: All UI components are hand-built in Svelte with no external libraries. No AG-Grid, no ECharts, no Chart.js. Data grids, Gantt charts, modals, and all interactive elements are built from scratch using native HTML, Tailwind CSS, and JavaScript within Svelte components. This eliminates external dependencies, reduces bundle size, and ensures full understanding and control of the codebase.
