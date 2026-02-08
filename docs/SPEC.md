# LineStart MVP — Technical Specification

## Project Overview
LineStart is a web-based production scheduling system for manufacturing/production environments. Enables Production Managers to assign jobs to resources (equipment/workstations) and Resource Operators to execute work while tracking time, completion status, and handling schedule disruptions.

## Business Problem
Production facilities rely on spreadsheets for scheduling, which lack:
- Real-time visibility into resource utilization
- Easy visualization of timelines and bottlenecks
- Flexible handling of schedule changes (downtime, rush orders, delays)
- Audit trails for accountability
- Multi-user collaboration capabilities

## Solution
LineStart is a purpose-built scheduling app with:
- **Production Queue**: Spreadsheet-like interface for job management
- **Resource Pages**: Dedicated terminals for operators to work on assignments
- **Gantt Chart**: Visual timeline of all resources and work orders
- **Downtime Management**: Handle scheduled and unscheduled disruptions
- **Audit Trails**: Complete history of who did what and when
- **Role-Based Access**: Admin, Production Manager, and Resource Operator roles

---

## Technical Stack

### Frontend
- **Framework**: SvelteKit with Svelte 5
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: All hand-built in Svelte. No external component libraries, no data grid libraries, no charting libraries. Data grids, Gantt charts, modals, and all interactive elements are built from scratch.
- **State**: Svelte stores

### Backend
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Auth (Google Sign-In only)
- **Functions**: Firebase Cloud Functions (Node.js)
- **Hosting**: Firebase Hosting
- **Notifications**: Firebase Cloud Messaging (FCM)

### Development Tools
- **Package Manager**: npm
- **Build Tool**: Vite (via SvelteKit)
- **Version Control**: Git
- **Linting**: ESLint + Prettier

---

## Data Architecture

### Core Collections

#### `/users`
```typescript
{
  uid: string,
  email: string,
  displayName: string,
  role: 'admin' | 'pm' | 'ro',
  createdBy: string,
  createdAt: Timestamp,
  modifiedBy: string,
  modifiedAt: Timestamp,
  fcmToken?: string
}
```

#### `/resources`
```typescript
{
  id: string,
  uid: string,                    // User-defined identifier
  name: string,
  operationalHours: {
    startTime: string,            // "08:00"
    endTime: string,              // "17:00"
    daysOfWeek: number[]          // [1,2,3,4,5]
  },
  overtimeHours: number,
  defaultProductionRate: number,  // units per hour
  setupTime: number,              // minutes
  currentDowntime: {
    isDown: boolean,
    startTime: Timestamp | null,
    reason: string | null
  }
}
```

**Subcollection**: `/resources/{id}/assignedWorkOrders/{workOrderId}`
```typescript
{
  workOrderId: string,
  jobId: string,
  position: number,
  addedAt: Timestamp
}
```

**Subcollection**: `/resources/{id}/scheduledDowntime`
```typescript
{
  id: string,
  startTime: Timestamp,
  endTime: Timestamp,
  reason: string,
  workOrderReference: string
}
```

#### `/jobs`
```typescript
{
  id: string,
  projectId: string,
  quantity: number,
  customFieldValues: {            // Dynamic fields
    [fieldName]: any
  },
  status: 'unassigned' | 'assigned' | 'in_progress' | 'finished',
  createdBy: string,
  createdAt: Timestamp,
  modifiedBy: string,
  modifiedAt: Timestamp
}
```

**Subcollection**: `/jobs/{jobId}/workOrders`
```typescript
{
  id: string,
  jobId: string,
  resourceId: string,
  type: 'production' | 'downtime',
  priority: 'high' | 'normal' | 'none',
  estimatedDuration: number,      // minutes
  scheduledStart: Timestamp | null,
  status: 'queued' | 'active' | 'paused' | 'completed' | 'partial',
  quantityTarget: number,
  quantityCompleted: number,
  assignedBy: string,
  assignedAt: Timestamp,
  startedBy?: string,
  startedAt?: Timestamp,
  completedBy?: string,
  completedAt?: Timestamp
}
```

**Subcollection**: `/jobs/{jobId}/workOrders/{woId}/timeEntries`
```typescript
{
  id: string,
  startTime: Timestamp,
  endTime: Timestamp | null,
  quantityCompleted: number,
  userId: string
}
```

**Subcollection**: `/jobs/{jobId}/auditLog`
```typescript
{
  id: string,
  globalAuditLogId: string        // Reference to /auditLogs
}
```

#### `/auditLogs` (Global)
```typescript
{
  id: string,
  jobId: string,
  workOrderId?: string,
  action: 'job_created' | 'job_assigned' | 'wo_started' | 'wo_paused' | 'wo_completed' | 'wo_partial' | 'wo_created_remainder' | 'downtime_reported' | 'downtime_cleared' | 'job_status_changed' | 'wo_reassigned',
  userId: string,
  timestamp: Timestamp,
  details: {
    oldValue?: any,
    newValue?: any,
    reason?: string
  }
}
```

#### `/ganttEntries` (Denormalized for Gantt Chart)
```typescript
{
  id: string,
  resourceId: string,
  resourceName: string,
  jobId: string,
  workOrderId: string,
  type: 'production' | 'downtime',
  priority: 'high' | 'normal' | 'none',
  status: string,
  scheduledStart: Timestamp,
  scheduledEnd: Timestamp,
  projectId: string,
  quantity: number
}
```
Maintained by Cloud Functions. Updated on every work order create, modify, or delete. The Gantt page queries this single collection by date range — it never crawls subcollections.

#### `/configuration/productionQueue`
```typescript
{
  customFields: [
    {
      name: string,
      type: 'string' | 'number' | 'date' | 'boolean',
      required: boolean,
      defaultValue?: any
    }
  ],
  customStates: [
    {
      name: string,
      color: string               // Hex color
    }
  ],
  defaultStates: [...]
}
```

#### `/configuration/system`
```typescript
{
  maintenanceJobIds: {
    critical: 'MAINT-CRITICAL',
    standard: 'MAINT-STANDARD'
  }
}
```

---

## Key Business Rules

### Job → Work Order Flow
1. Jobs enter Production Queue (CSV import or manual entry)
2. PM assigns job to resource → creates Work Order
3. Work Order appears on Resource Page
4. RO starts work → tracks time
5. RO completes work → updates quantity
6. If partial completion → system creates new WO for remainder, original WO marked 'partial', new WO returns to queue with status 'queued' and no resource assignment for PM to assign
7. If full completion → WO marked 'completed', job status updated to 'finished' if all quantity fulfilled

### Work Order Duration Calculation
```
estimatedDuration = setupTime + (quantity / defaultProductionRate)
```
- `setupTime` is in minutes
- `defaultProductionRate` is units per hour
- Result is in minutes
- Calculated when WO is created, based on assigned resource's characteristics
- Used for Gantt timeline positioning
- Example: 15 min setup + (100 units / 30 units per hour) = 15 + 200 = 215 minutes

### Downtime Handling

**Scheduled Downtime:**
- Created by PM in Resource Config
- Appears as Work Order with `type: 'downtime'`
- Uses maintenance job ID: `MAINT-STANDARD`
- Blocks time on Gantt chart
- Prevents other WO assignments during this time

**Unscheduled Downtime:**
- Reported by RO from Resource Page
- Sets `resource.currentDowntime.isDown = true`
- As long as the resource is marked down, the timeline continues to push out. This is not a one-time 30-minute shift — downtime continuously extends until cleared.
- Uses maintenance job ID: `MAINT-CRITICAL`
- Sends FCM notification to all PMs
- PM is responsible for monitoring downtime duration and redistributing work orders to other resources if the machine will not return in time
- When RO clears downtime, the push stops and remaining WOs proceed from their current pushed positions

### Partial Completion
- If RO completes less than full quantity:
  - Original WO status → 'partial'
  - Actual quantity and time logged on the original WO
  - System automatically creates a NEW work order under the same job for the remaining quantity
  - New WO has status 'queued', no resource assignment, quantity = original target minus completed amount
  - New WO returns to Production Queue for PM to assign (same or different resource)
  - Audit log records both the partial completion and the new WO creation

### Multiple Active Work Orders
- An operator can have multiple WOs active simultaneously on the same resource
- Each active WO tracks its own time entries independently
- The Resource Page UI shows all active WOs in the Current Work section
- This supports scenarios where ROs work on similar jobs at the same time

### Priority System (MVP)
- No UI controls for setting or changing priority in MVP
- All work orders default to `normal` priority
- The priority field exists in the data model for future use
- Do not build priority sorting, filtering, or visual indicators

### Job Status (MVP — Four Fixed States)
- `unassigned` — job created, no work order exists
- `assigned` — at least one work order exists and is queued
- `in_progress` — at least one work order is active
- `finished` — all quantity completed across all work orders

### Audit Trail
- Every state-changing action logged to `/auditLogs` (global, append-only)
- Reference created in `/jobs/{id}/auditLog`
- Tracks: who, what, when, old/new values
- Audit entries are immutable — no role can update or delete them
- Visible in Job History modal

---

## User Roles & Permissions

### Admin
- Full access to everything
- Create/edit/delete users (PM and RO)
- Manage all resources
- Configure Production Queue settings
- View all audit logs

### Production Manager (PM)
- Full read/write on Production Queue
- Assign jobs to resources
- Reassign/recall work orders
- Create/edit resources
- Schedule downtime
- View all audit logs
- Create Resource Operator users only (cannot create PMs or Admins)

### Resource Operator (RO)
- Read-only Production Queue
- Read-only Resource Config
- Full access to all Resource Pages (no per-resource access restrictions in MVP):
  - Start/pause/complete work orders
  - Report unscheduled downtime
  - Clear downtime
  - Enter quantity completed
  - View upcoming assignments
- RO writes on work orders are restricted to: status, quantityCompleted, startedBy, startedAt, completedBy, completedAt
- RO writes on resources are restricted to: currentDowntime field only

---

## Application Pages

### 1. Login (`/login`)
- Google Sign-In only
- After Google auth, system checks for a `/users` document matching the UID
- If no `/users` document exists → show Access Denied screen. Do not create a user record. User must be pre-registered by an Admin.
- If document exists → redirect based on role:
  - Admin/PM → `/production-queue`
  - RO → `/resources`

### 2. Production Queue (`/production-queue`)
**Access**: PM (full), RO (read-only)

**Features**:
- Spreadsheet-style data grid (hand-built, no external library)
- Add jobs manually
- Import CSV (validate headers, create jobs)
- Export current view to CSV
- Assign jobs to resources (dropdown)
- Change job status (colored by config)
- Sort/filter by any column
- Click job ID → open history modal
- Settings button → configure custom fields and states

**Components**:
- `PQDataGrid.svelte` — Main table
- `PQToolbar.svelte` — Actions bar
- `AddJobModal.svelte` — Create new job form
- `PQConfigModal.svelte` — Custom fields/states settings
- `JobHistoryModal.svelte` — Audit trail viewer

### 3. Resource List (`/resources`)
**Access**: All roles

**Features**:
- Card view of all resources
- Shows status (operational/downtime)
- Count of queued work orders
- Click card → navigate to resource page
- PM: Add new resource button

**Components**:
- `ResourceCard.svelte`
- `AddResourceModal.svelte` (PM only)

### 4. Resource Page (`/resources/[resourceId]`)
**Access**: RO (full for actions), PM (view-only)

**Features**:
- Current work orders display (supports multiple active WOs simultaneously)
  - Job details, estimated duration per WO
  - Start/pause/complete buttons per WO
  - Quantity completed input per WO
- Upcoming work orders queue
  - Sorted by position (chronological)
  - Show scheduled times if set
  - Start work button (creates new active WO — no restriction on number of active WOs)
- Completed history (toggle to show/hide)
- Report downtime button
- Clear downtime button (if currently down)

**Components**:
- `ResourceHeader.svelte`
- `CurrentWorkOrder.svelte`
- `UpcomingWorkOrders.svelte`
- `CompletedHistory.svelte`
- `DowntimeModal.svelte`

### 5. Gantt Chart (`/gantt`)
**Access**: All roles (view-only for MVP)

**Features**:
- Timeline visualization of all resources (hand-built, no external charting library)
- X-axis: Time (hourly/daily views)
- Y-axis: Resources
- Bars: Work orders (color-coded by status)
- Blocks: Scheduled/unscheduled downtime
- Date range picker
- Zoom in/out
- Click WO → show details
- Data sourced from `/ganttEntries` collection (single query by date range)

**Components**:
- `GanttTimeline.svelte`
- `GanttControls.svelte`

### 6. Resource Configuration (`/resource-config`)
**Access**: PM (full), RO (read-only)

**Features**:
- List all resources with full details
- Edit resource settings:
  - Operational hours
  - Production rate
  - Setup time
  - Overtime availability
- Schedule downtime (creates maintenance WO)
- Delete resource (if no active WOs)

**Components**:
- `ResourceConfigCard.svelte`
- `EditResourceModal.svelte`
- `ScheduleDowntimeModal.svelte`

### 7. User Management (`/users`)
**Access**: Admin (full), PM (create RO only)

**Features**:
- List all users
- Create new users (pre-registration — user must later sign in via Google to access the app)
- Edit user roles (Admin can change any role; PM can only manage ROs)
- Delete users
- Admin can manage all, PM can only manage ROs

**Components**:
- `UserTable.svelte`
- `AddUserModal.svelte`

### 8. Navigation Bar (All Pages)
- Logo
- Links: Production Queue, Resources, Gantt, Config, Users
- User avatar
- Logout button
- Role-based visibility of links

---

## Critical Workflows

### Workflow 1: Create and Assign Job
1. PM clicks "Add Job" or imports CSV
2. Job created in `/jobs` with status `unassigned`
3. PM selects job row, chooses resource from dropdown
4. System:
   - Creates WO in `/jobs/{id}/workOrders`
   - Calculates `estimatedDuration` using `setupTime + (quantity / defaultProductionRate)`
   - Creates document in `/resources/{id}/assignedWorkOrders` subcollection
   - Creates document in `/ganttEntries`
   - Updates job status to `assigned`
   - Logs audit entry
   - Sends FCM notification to ROs
5. WO appears on Resource Page in "Upcoming" section

### Workflow 2: Complete Work Order
1. RO navigates to their Resource Page
2. Clicks "Start Work" on queued WO
3. System:
   - Sets WO status to `active`
   - Creates time entry with startTime
   - Updates job status to `in_progress`
   - Logs audit
4. RO works, enters quantity completed
5. RO clicks "Complete"
6. System checks:
   - If quantity completed == target → WO status `completed`, remove from resource's assignedWorkOrders subcollection, update ganttEntry, update job status to `finished` if all quantity fulfilled
   - If quantity completed < target → WO status `partial`, create NEW WO for remainder (status `queued`, no resource, quantity = target minus completed), new WO returns to Production Queue
7. Close time entry, log completion and any remainder WO creation

### Workflow 3: Report Unscheduled Downtime
1. RO clicks "Report Downtime" on Resource Page
2. Enters reason in modal
3. System:
   - Sets `resource.currentDowntime.isDown = true` with timestamp and reason
   - Creates WO with type `downtime`, jobId `MAINT-CRITICAL`
   - Timeline continuously pushes as long as resource is marked down
   - Creates ganttEntry for downtime
   - Logs audit
   - Sends FCM to all PMs
4. PM receives notification, can reassign WOs to other resources
5. When repaired, RO clicks "Clear Downtime"
   - Sets `resource.currentDowntime.isDown = false`
   - Downtime push stops, remaining WOs proceed from pushed positions
   - Logs audit, updates ganttEntry

### Workflow 4: View Job History
1. User clicks job ID in Production Queue
2. Modal opens showing audit trail:
   - Fetches `/jobs/{id}/auditLog` references
   - Loads full entries from `/auditLogs`
   - Displays chronologically with user names, actions, timestamps
3. Shows: created, assigned, status changes, reassignments, completions, partial completions, remainder WO creation

---

## Firebase Cloud Functions

### `onWorkOrderCreated` (Firestore Trigger)
```
Trigger: onCreate /jobs/{jobId}/workOrders/{woId}
Actions:
  - Create corresponding document in /ganttEntries
  - Send FCM notification to relevant ROs
```

### `onWorkOrderUpdated` (Firestore Trigger)
```
Trigger: onUpdate /jobs/{jobId}/workOrders/{woId}
Actions:
  - Update corresponding /ganttEntries document
  - If status changed to 'partial': create new WO for remainder quantity, log audit
  - If status changed to 'completed': check if all job quantity fulfilled, update job status
```

### `onDowntimeReported` (Firestore Trigger)
```
Trigger: onUpdate /resources/{resourceId}
Condition: currentDowntime.isDown changed to true
Actions:
  - Send FCM notification to all PMs
  - Create downtime ganttEntry
```

### `onDowntimeCleared` (Firestore Trigger)
```
Trigger: onUpdate /resources/{resourceId}
Condition: currentDowntime.isDown changed from true to false
Actions:
  - Update downtime ganttEntry with end time
  - Notify PMs
```

### `sendFCMNotification` (Callable)
```
Triggered manually from client when needed
Params: userId, title, body, data
Fetches user's FCM token, sends notification via Firebase Admin SDK
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isAdmin() {
      return isAuthenticated() && getUserData().role == 'admin';
    }
    
    function isPM() {
      return isAuthenticated() && 
             (getUserData().role == 'pm' || getUserData().role == 'admin');
    }
    
    function isRO() {
      return isAuthenticated() && getUserData().role == 'ro';
    }
    
    // Users: Admin full access, PM can create/manage ROs only
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin() || 
                      (isPM() && request.resource.data.role == 'ro');
      allow update: if isAdmin() || 
                      (isPM() && resource.data.role == 'ro' && request.resource.data.role == 'ro');
      allow delete: if isAdmin() || 
                      (isPM() && resource.data.role == 'ro');
    }
    
    // Jobs: PM full access, all can read
    match /jobs/{jobId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isPM();
      
      // Work Orders: PM full access, RO can update restricted fields only
      match /workOrders/{workOrderId} {
        allow read: if isAuthenticated();
        allow create, delete: if isPM();
        allow update: if isPM() || 
                        (isRO() && 
                         resource.data.status in ['queued', 'active', 'paused'] &&
                         request.resource.data.diff(resource.data).affectedKeys()
                           .hasOnly(['status', 'quantityCompleted', 'startedBy', 'startedAt', 'completedBy', 'completedAt']));
        
        // Time Entries: RO and PM can create and update
        match /timeEntries/{entryId} {
          allow read: if isAuthenticated();
          allow create, update: if isRO() || isPM();
        }
      }
      
      // Audit Log References: all can read, all can create, nobody can update or delete
      match /auditLog/{logId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated();
        allow update, delete: if false;
      }
    }
    
    // Resources: PM full access, RO can only update currentDowntime
    match /resources/{resourceId} {
      allow read: if isAuthenticated();
      allow create, delete: if isPM();
      allow update: if isPM() || 
                      (isRO() && 
                       request.resource.data.diff(resource.data).affectedKeys()
                         .hasOnly(['currentDowntime']));
      
      // Assigned Work Orders subcollection
      match /assignedWorkOrders/{assignmentId} {
        allow read: if isAuthenticated();
        allow create, update, delete: if isPM();
      }
      
      // Scheduled Downtime
      match /scheduledDowntime/{downtimeId} {
        allow read: if isAuthenticated();
        allow create, update, delete: if isPM();
      }
    }
    
    // Global Audit Logs: PM can read, all can create, nobody can update or delete
    match /auditLogs/{logId} {
      allow read: if isPM();
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }
    
    // Gantt Entries: all can read, only Cloud Functions should write (admin SDK bypasses rules)
    match /ganttEntries/{entryId} {
      allow read: if isAuthenticated();
      allow write: if false;  // Only written by Cloud Functions via Admin SDK
    }
    
    // Configuration: all can read, PM can write
    match /configuration/{configId} {
      allow read: if isAuthenticated();
      allow write: if isPM();
    }
  }
}
```

---

## Project File Structure

```
linestart/
├── src/
│   ├── routes/
│   │   ├── login/
│   │   │   └── +page.svelte
│   │   ├── production-queue/
│   │   │   └── +page.svelte
│   │   ├── resources/
│   │   │   ├── +page.svelte
│   │   │   └── [resourceId]/
│   │   │       └── +page.svelte
│   │   ├── gantt/
│   │   │   └── +page.svelte
│   │   ├── resource-config/
│   │   │   └── +page.svelte
│   │   └── users/
│   │       └── +page.svelte
│   ├── lib/
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── calculations.ts
│   │   │   ├── firestore.ts
│   │   │   ├── csv.ts
│   │   │   └── notifications.ts
│   │   ├── stores/
│   │   │   ├── auth.ts
│   │   │   ├── config.ts
│   │   │   ├── jobs.ts
│   │   │   └── resources.ts
│   │   ├── components/
│   │   │   ├── NavBar.svelte
│   │   │   ├── LoginForm.svelte
│   │   │   ├── pq/
│   │   │   │   ├── PQDataGrid.svelte
│   │   │   │   ├── PQToolbar.svelte
│   │   │   │   ├── AddJobModal.svelte
│   │   │   │   ├── PQConfigModal.svelte
│   │   │   │   └── JobHistoryModal.svelte
│   │   │   ├── resources/
│   │   │   │   ├── ResourceCard.svelte
│   │   │   │   └── AddResourceModal.svelte
│   │   │   ├── resource/
│   │   │   │   ├── ResourceHeader.svelte
│   │   │   │   ├── CurrentWorkOrder.svelte
│   │   │   │   ├── UpcomingWorkOrders.svelte
│   │   │   │   ├── CompletedHistory.svelte
│   │   │   │   └── DowntimeModal.svelte
│   │   │   ├── gantt/
│   │   │   │   ├── GanttTimeline.svelte
│   │   │   │   └── GanttControls.svelte
│   │   │   ├── config/
│   │   │   │   ├── ResourceConfigCard.svelte
│   │   │   │   ├── EditResourceModal.svelte
│   │   │   │   └── ScheduleDowntimeModal.svelte
│   │   │   └── users/
│   │   │       ├── UserTable.svelte
│   │   │       └── AddUserModal.svelte
│   │   └── firebase.ts
│   └── app.html
├── functions/
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── docs/
│   ├── SPEC.md
│   ├── DESIGN_DECISIONS.md
│   └── FUTURE_FEATURES.md
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .firebaserc
├── CLAUDE.md
├── package.json
├── svelte.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Development Phases (12 Tasks)

### Phase 1: Foundation (Tasks 1-4)
**Task 01: Firebase Setup**
- Initialize SvelteKit project with Svelte 5
- Configure Firebase (Auth, Firestore, Functions, Hosting)
- Create firebase.json, .firebaserc, firestore.rules
- Deploy initial setup

**Task 02: Data Models**
- Create TypeScript interfaces in `/src/lib/types/index.ts`
- Define enums for roles, statuses, priorities
- Export all types

**Task 03: Shared Utilities**
- `/src/lib/utils/calculations.ts` — Duration calculations using corrected formula
- `/src/lib/utils/firestore.ts` — CRUD operations for all collections and subcollections
- `/src/lib/utils/csv.ts` — Import/export logic
- `/src/lib/utils/notifications.ts` — FCM helpers

**Task 04: Authentication**
- Login page with Google Sign-In
- Post-auth check for `/users` document — Access Denied screen if not pre-registered
- Auth guards for routes
- NavBar with role-based navigation
- Svelte stores for auth state

### Phase 2: Core Features (Tasks 5-7)
**Task 05: Production Queue**
- PQ page with hand-built data grid
- Add/edit/delete jobs
- CSV import/export
- Configuration modal (custom fields/states)
- Job history modal
- Assignment dropdown

**Task 06: Resource Management**
- Resource list page
- Resource config page
- Add/edit/delete resources
- Operational hours, production rates, setup time
- Schedule downtime functionality

**Task 07: Resource Pages**
- Individual resource page per resource
- Current work orders display (supports multiple active WOs)
- Start/pause/complete actions per WO
- Quantity tracking per WO
- Upcoming queue
- Completed history
- Report/clear downtime

### Phase 3: Visualization & Functions (Tasks 8-9)
**Task 08: Gantt Chart**
- Hand-built timeline visualization
- Display all resources and WOs from /ganttEntries collection
- Show scheduled/unscheduled downtime
- Date range controls and zoom
- View-only for MVP

**Task 09: Cloud Functions**
- `onWorkOrderCreated` — create ganttEntry, notify ROs
- `onWorkOrderUpdated` — update ganttEntry, handle partial completion remainder WO creation
- `onDowntimeReported` — notify PMs, create downtime ganttEntry
- `onDowntimeCleared` — update ganttEntry, notify PMs
- `sendFCMNotification` — callable function
- Deploy functions

### Phase 4: Admin & Polish (Tasks 10-12)
**Task 10: Security Rules**
- Complete firestore.rules implementation with RO field-level restrictions
- Audit log immutability enforcement
- PM role escalation prevention
- ganttEntries write-only via Admin SDK
- Test with Firebase Emulator
- Deploy rules

**Task 11: User Management**
- User management page
- Pre-register users (create /users document before they log in)
- Edit user roles with appropriate restrictions
- Delete users
- Admin and PM access levels

**Task 12: Testing & Deployment**
- Integration testing
- User flow testing
- Performance optimization
- Production deployment
- Final bug fixes

---

## MVP Feature Checklist

### Must-Have (MVP)
- [ ] Google Authentication with pre-registration requirement
- [ ] Role-based access (Admin, PM, RO)
- [ ] Access Denied screen for unregistered users
- [ ] Production Queue with hand-built data grid
- [ ] Custom fields and states configuration
- [ ] CSV import/export
- [ ] Job assignment to resources
- [ ] Work order creation with corrected duration calculation
- [ ] Resource pages with multiple simultaneous active WOs
- [ ] Start/pause/complete WO functionality
- [ ] Partial completion with automatic remainder WO creation
- [ ] Scheduled downtime
- [ ] Unscheduled downtime with continuous timeline push
- [ ] Downtime as work orders
- [ ] Job history/audit trail (append-only)
- [ ] Hand-built Gantt chart (view-only) using /ganttEntries collection
- [ ] Manual refresh with FCM notifications
- [ ] Resource configuration (hours, rates, setup time)
- [ ] User management with pre-registration
- [ ] Four fixed job statuses: Unassigned, Assigned, In Progress, Finished
- [ ] All work orders default to normal priority (no priority UI controls)

---

## Key Dependencies

### NPM Packages
```json
{
  "dependencies": {
    "svelte": "^5.0.0",
    "@sveltejs/kit": "^2.0.0",
    "firebase": "^10.7.0",
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.5.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0",
    "vite": "^5.0.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

---

## Success Criteria

### MVP is complete when:
1. Admin can pre-register users who then log in via Google
2. Unregistered Google users see Access Denied
3. PM can create/import jobs and assign to resources
4. RO can start/complete work orders and track time
5. Multiple WOs can be active simultaneously on a resource
6. System handles partial completions by creating remainder WOs automatically
7. Downtime (scheduled/unscheduled) blocks resources — unscheduled continuously pushes timeline
8. Gantt chart displays timeline accurately from /ganttEntries
9. Audit trails show complete, immutable history
10. FCM notifications trigger on key events
11. All three roles have appropriate access controls with field-level RO restrictions
12. CSV import/export works reliably
13. Application deployed and accessible via Firebase Hosting

### Performance Targets
- Production Queue loads <2 seconds with 500 jobs
- Gantt chart renders <3 seconds with 50 resources
- Resource page loads <1 second
- All Firestore queries optimized with indexes

### Security Targets
- All routes protected by authentication
- Unregistered users cannot access any page except Access Denied
- Firestore rules prevent unauthorized access
- RO writes restricted to specific fields only
- Audit logs immutable — no updates or deletes by any role
- ganttEntries writable only by Cloud Functions (Admin SDK)
- PM cannot escalate user roles to PM or Admin

---

## Notes

- **Manual refresh, NOT real-time listeners** for MVP (cost optimization)
- **FCM for urgent notifications** — token requested at login, stored in /users, refresh handled on next login
- **Downtime is a work order type**, not a separate entity
- **Estimated duration calculated at WO creation**, not job creation
- **Subcollections used for**: assignedWorkOrders, workOrders, timeEntries, auditLog, scheduledDowntime
- **Dual audit logs**: per-job references + global collection for system-wide queries
- **ganttEntries are denormalized** and maintained by Cloud Functions
- **Custom fields are configured once** in PQ settings, applied to all jobs
- **Status colors come from configuration**, not stored per job
- **Google Auth only**, no email/password for MVP
- **Desktop-first design**, mobile responsiveness deferred
- **All UI components hand-built** — no external grid, chart, or component libraries
- **Svelte 5 with runes** — do not use Svelte 4 legacy syntax
- **All work orders default to normal priority** — no priority UI controls in MVP

---

**Project Start Date**: February 3, 2026
**Target MVP Completion**: ~13 weeks (following 12-task plan)
