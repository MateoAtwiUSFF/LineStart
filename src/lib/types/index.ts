/**
 * LineStart Type Definitions
 * All TypeScript interfaces and enums for the application
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * User roles with hierarchical permissions
 * - admin: Full access to everything
 * - pm: Production Manager - full access to jobs, resources, config
 * - ro: Resource Operator - limited access, can execute work
 */
export enum UserRole {
	ADMIN = 'admin',
	PM = 'pm',
	RO = 'ro'
}

/**
 * Job status - four fixed states for MVP
 * - unassigned: Job created, no work order exists
 * - assigned: At least one work order exists and is queued
 * - in_progress: At least one work order is active
 * - finished: All quantity completed across all work orders
 */
export enum JobStatus {
	UNASSIGNED = 'unassigned',
	ASSIGNED = 'assigned',
	IN_PROGRESS = 'in_progress',
	FINISHED = 'finished'
}

/**
 * Work order status
 * - queued: Assigned to resource, waiting
 * - active: Operator is working on it
 * - paused: Operator paused work
 * - completed: Full quantity done
 * - partial: Some quantity done, remainder returns to queue
 */
export enum WorkOrderStatus {
	QUEUED = 'queued',
	ACTIVE = 'active',
	PAUSED = 'paused',
	COMPLETED = 'completed',
	PARTIAL = 'partial'
}

/**
 * Work order type
 * - production: Standard production work
 * - downtime: Scheduled or unscheduled maintenance
 */
export enum WorkOrderType {
	PRODUCTION = 'production',
	DOWNTIME = 'downtime'
}

/**
 * Priority levels (MVP: all default to normal, no UI controls)
 * - high: High priority work
 * - normal: Standard priority (default)
 * - none: No priority set
 */
export enum Priority {
	HIGH = 'high',
	NORMAL = 'normal',
	NONE = 'none'
}

/**
 * Audit log action types
 */
export enum AuditAction {
	JOB_CREATED = 'job_created',
	JOB_ASSIGNED = 'job_assigned',
	JOB_STATUS_CHANGED = 'job_status_changed',
	WO_STARTED = 'wo_started',
	WO_PAUSED = 'wo_paused',
	WO_COMPLETED = 'wo_completed',
	WO_PARTIAL = 'wo_partial',
	WO_CREATED_REMAINDER = 'wo_created_remainder',
	WO_REASSIGNED = 'wo_reassigned',
	DOWNTIME_REPORTED = 'downtime_reported',
	DOWNTIME_CLEARED = 'downtime_cleared'
}

/**
 * Custom field types for Production Queue configuration
 */
export enum CustomFieldType {
	STRING = 'string',
	NUMBER = 'number',
	DATE = 'date',
	BOOLEAN = 'boolean'
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * User document (/users/{uid})
 * Represents a user account with role-based permissions
 */
export interface User {
	uid: string;
	email: string;
	displayName: string;
	role: UserRole;
	createdBy: string;
	createdAt: Timestamp;
	modifiedBy: string;
	modifiedAt: Timestamp;
	fcmToken?: string;
}

/**
 * Operational hours for a resource
 */
export interface OperationalHours {
	startTime: string; // Format: "HH:MM" (e.g., "08:00")
	endTime: string; // Format: "HH:MM" (e.g., "17:00")
	daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc. (e.g., [1,2,3,4,5])
}

/**
 * Current downtime status for a resource
 */
export interface CurrentDowntime {
	isDown: boolean;
	startTime: Timestamp | null;
	reason: string | null;
}

/**
 * Resource document (/resources/{id})
 * Represents a machine or workstation
 */
export interface Resource {
	id: string;
	uid: string; // User-defined identifier
	name: string;
	operationalHours: OperationalHours;
	overtimeHours: number;
	defaultProductionRate: number; // Units per hour
	setupTime: number; // Minutes
	currentDowntime: CurrentDowntime;
}

/**
 * Assigned work order reference (subcollection: /resources/{id}/assignedWorkOrders/{woId})
 * Tracks which work orders are assigned to a resource
 */
export interface AssignedWorkOrder {
	workOrderId: string;
	jobId: string;
	position: number; // Order in the queue
	addedAt: Timestamp;
}

/**
 * Scheduled downtime (subcollection: /resources/{id}/scheduledDowntime/{id})
 * Planned maintenance windows
 */
export interface ScheduledDowntime {
	id: string;
	startTime: Timestamp;
	endTime: Timestamp;
	reason: string;
	workOrderReference: string; // Reference to the downtime work order
}

/**
 * Job document (/jobs/{id})
 * Represents a production job
 */
export interface Job {
	id: string;
	projectId: string;
	quantity: number;
	customFieldValues: Record<string, any>; // Dynamic fields based on configuration
	status: JobStatus;
	createdBy: string;
	createdAt: Timestamp;
	modifiedBy: string;
	modifiedAt: Timestamp;
}

/**
 * Work order (subcollection: /jobs/{jobId}/workOrders/{id})
 * Represents a specific assignment of work to a resource
 */
export interface WorkOrder {
	id: string;
	jobId: string;
	resourceId: string;
	type: WorkOrderType;
	priority: Priority;
	estimatedDuration: number; // Minutes (calculated: setupTime + quantity / productionRate)
	scheduledStart: Timestamp | null;
	status: WorkOrderStatus;
	quantityTarget: number;
	quantityCompleted: number;
	assignedBy: string;
	assignedAt: Timestamp;
	startedBy?: string;
	startedAt?: Timestamp;
	completedBy?: string;
	completedAt?: Timestamp;
}

/**
 * Time entry (subcollection: /jobs/{jobId}/workOrders/{woId}/timeEntries/{id})
 * Tracks actual time spent on a work order
 */
export interface TimeEntry {
	id: string;
	startTime: Timestamp;
	endTime: Timestamp | null;
	quantityCompleted: number;
	userId: string;
}

/**
 * Audit log reference (subcollection: /jobs/{jobId}/auditLog/{id})
 * Reference to global audit log entry
 */
export interface AuditLogReference {
	id: string;
	globalAuditLogId: string; // Reference to /auditLogs/{id}
}

// ============================================================================
// GLOBAL COLLECTIONS
// ============================================================================

/**
 * Global audit log entry (/auditLogs/{id})
 * Immutable record of all state-changing actions
 */
export interface AuditLogEntry {
	id: string;
	jobId: string;
	workOrderId?: string;
	action: AuditAction;
	userId: string;
	timestamp: Timestamp;
	details: {
		oldValue?: any;
		newValue?: any;
		reason?: string;
	};
}

/**
 * Gantt chart entry (/ganttEntries/{id})
 * Denormalized collection for efficient Gantt chart rendering
 * Maintained by Cloud Functions
 */
export interface GanttEntry {
	id: string;
	resourceId: string;
	resourceName: string;
	jobId: string;
	workOrderId: string;
	type: WorkOrderType;
	priority: Priority;
	status: WorkOrderStatus;
	scheduledStart: Timestamp;
	scheduledEnd: Timestamp;
	projectId: string;
	quantity: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Custom field definition for Production Queue
 */
export interface CustomField {
	name: string;
	type: CustomFieldType;
	required: boolean;
	defaultValue?: any;
}

/**
 * Custom status/state definition for jobs
 */
export interface CustomState {
	name: string;
	color: string; // Hex color code
}

/**
 * Production Queue configuration (/configuration/productionQueue)
 */
export interface ProductionQueueConfig {
	customFields: CustomField[];
	customStates: CustomState[];
	defaultStates: CustomState[];
}

/**
 * System configuration (/configuration/system)
 */
export interface SystemConfig {
	maintenanceJobIds: {
		critical: string; // e.g., "MAINT-CRITICAL"
		standard: string; // e.g., "MAINT-STANDARD"
	};
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Type for creating a new user (without generated fields)
 */
export type CreateUserInput = Omit<User, 'uid' | 'createdAt' | 'modifiedAt'>;

/**
 * Type for creating a new job (without generated fields)
 */
export type CreateJobInput = Omit<Job, 'id' | 'createdAt' | 'modifiedAt' | 'status' | 'createdBy' | 'modifiedBy'>;

/**
 * Type for creating a new resource (without generated fields)
 */
export type CreateResourceInput = Omit<Resource, 'id'>;

/**
 * Type for creating a new work order (without generated fields)
 */
export type CreateWorkOrderInput = Omit<
	WorkOrder,
	'id' | 'assignedAt' | 'startedBy' | 'startedAt' | 'completedBy' | 'completedAt'
>;

/**
 * Type for updating work order fields (RO-restricted fields only)
 */
export type ROWorkOrderUpdate = Pick<
	WorkOrder,
	'status' | 'quantityCompleted' | 'startedBy' | 'startedAt' | 'completedBy' | 'completedAt'
>;

/**
 * Type for updating resource downtime (RO-restricted field only)
 */
export type ROResourceUpdate = Pick<Resource, 'currentDowntime'>;
