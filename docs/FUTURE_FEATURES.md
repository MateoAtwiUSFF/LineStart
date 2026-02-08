# Future Features Register — LineStart

This document tracks features explicitly identified as out of scope for the MVP but intended for future releases. Do not build any of these features unless specifically instructed. When building MVP features, ensure your implementation does not block or make these future features significantly harder to add.

---

## From Original Spec

| # | Feature | Description | Architectural Notes |
|---|---------|-------------|-------------------|
| 1 | Multi-step workflows | Jobs route through a sequence of resources automatically (Machine A → B → C) | Data model should accommodate a job having multiple work orders on different resources in sequence. The current model supports this — just needs orchestration logic. |
| 2 | AI-suggested assignments | System recommends optimal resource for a job based on historical performance data | Requires historical data from audit logs and time entries. Current audit trail captures the data needed. |
| 3 | AI-predicted durations | Estimated durations based on actual historical completion times rather than fixed production rates | Requires comparing estimated vs actual durations from completed work orders. Time entries already capture this. |
| 4 | Interactive Gantt chart | Drag-and-drop rescheduling directly on the Gantt timeline | Gantt is read-only in MVP. The /ganttEntries collection would need to support writes from the client, which means updating security rules and adding write-back logic to sync changes to actual work orders. |
| 5 | Mobile applications | Tablet and phone-optimized interfaces; mobile responsive design | MVP is desktop-first. TailwindCSS supports responsive design, so the path is available but not built out. |
| 6 | Custom resource actions | Bespoke buttons and functionality per resource type | Would require a resource-type configuration system and dynamic UI rendering. |
| 7 | Resource capability matching | System prevents assigning jobs to machines that can't handle that job type | Requires defining job types and resource capabilities, then validation at assignment time. |
| 8 | Real-time listeners | Firestore onSnapshot real-time updates as optional upgrade from manual refresh + FCM | Front-end architecture should be WebSocket/listener-ready. Svelte stores can be swapped from fetch-based to listener-based without rewriting components. |
| 9 | Advanced analytics dashboard | Reporting on utilization rates, estimated vs actual times, throughput trends | Data is captured in work orders, time entries, and audit logs. Needs aggregation and visualization layer. |
| 10 | Capacity planning tools | Forward-looking scheduling based on resource availability and incoming demand | Requires analyzing scheduled work against resource operational hours and identifying gaps. |
| 11 | ERP integrations | Connect to existing enterprise resource planning systems for job import and status sync | Would likely require Cloud Functions as middleware to translate between systems. |
| 12 | Maintenance resource type | Dedicated resource classification for maintenance crews vs production machines | Would extend the resource model with a type field and type-specific behaviors. |

---

## From Technical Review Q&A

| # | Feature | Description | Architectural Notes |
|---|---------|-------------|-------------------|
| 13 | Resource-operator access control | Restrict which operators can access which Resource Pages | Currently all ROs can access all resources. Would require an assignment/permission mapping between users and resources. The /users and /resources collections would need a linking mechanism. |
| 14 | Operator training and tracking | Track which operators are trained and certified on which resources | Related to #13. Would add a training/certification subcollection or linked collection. Could gate resource access on certification status. |
| 15 | Priority controls and queue ordering | UI controls for setting WO priority; manual reordering of resource queues by PM | Priority field exists in the data model at `normal` default. Needs: priority selector in PQ, sorting logic on Resource Page, visual indicators, and potentially drag-and-drop reordering of the queue. |
| 16 | Complex job status derivation | Job status automatically derived from aggregate state of its work orders across multiple resources | MVP uses four fixed states set explicitly. Future version could compute status from WO states (e.g., if WOs are split across resources, status reflects the most advanced state). |
| 17 | Robust FCM token management | Automatic token refresh, multi-device support, failed notification retry logic | MVP requests token at login and stores it. Future version should handle token rotation, support multiple devices per user, and retry or queue failed sends. |
| 18 | Push/email notifications | Notifications delivered via mobile push or email in addition to in-app browser alerts | MVP uses browser-based FCM only. Would require email integration (SendGrid, Firebase Extensions) and mobile FCM configuration. |

---

## Guidelines for MVP Development

When implementing any MVP feature, ask yourself:
1. **Does my data model prevent this future feature?** If adding multi-step workflows later would require a migration, restructure now.
2. **Am I hardcoding something that should be configurable?** If priority will be user-settable later, don't hardcode display logic that ignores the priority field.
3. **Am I creating tight coupling?** If components directly depend on the four fixed job statuses, make the status list come from a constant or config so it can be extended.

When in doubt, ask before building.
