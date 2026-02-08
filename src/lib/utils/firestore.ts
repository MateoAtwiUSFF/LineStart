/**
 * Firestore utilities for LineStart
 * All Firestore CRUD operations go through this file
 * Components never call Firestore directly
 */

import {
	collection,
	doc,
	getDoc,
	getDocs,
	addDoc,
	updateDoc,
	deleteDoc,
	query,
	where,
	orderBy,
	limit,
	type WhereFilterOp,
	type OrderByDirection,
	serverTimestamp,
	Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type {
	User,
	Resource,
	Job,
	WorkOrder,
	TimeEntry,
	AuditLogEntry,
	GanttEntry,
	AssignedWorkOrder,
	ScheduledDowntime,
	ProductionQueueConfig,
	SystemConfig,
	CreateUserInput,
	CreateJobInput,
	CreateResourceInput,
	CreateWorkOrderInput
} from '$lib/types';

// ============================================================================
// USER OPERATIONS
// ============================================================================

/**
 * Get user by UID
 */
export async function getUser(uid: string): Promise<User | null> {
	const userDoc = await getDoc(doc(db, 'users', uid));
	if (!userDoc.exists()) return null;
	return userDoc.data() as User;
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<User[]> {
	const usersSnapshot = await getDocs(collection(db, 'users'));
	return usersSnapshot.docs.map((doc) => doc.data() as User);
}

/**
 * Create a new user
 */
export async function createUser(uid: string, userData: CreateUserInput): Promise<void> {
	await updateDoc(doc(db, 'users', uid), {
		...userData,
		uid,
		createdAt: serverTimestamp(),
		modifiedAt: serverTimestamp()
	});
}

/**
 * Update user
 */
export async function updateUser(
	uid: string,
	updates: Partial<User>,
	modifiedBy: string
): Promise<void> {
	await updateDoc(doc(db, 'users', uid), {
		...updates,
		modifiedBy,
		modifiedAt: serverTimestamp()
	});
}

/**
 * Delete user
 */
export async function deleteUser(uid: string): Promise<void> {
	await deleteDoc(doc(db, 'users', uid));
}

// ============================================================================
// RESOURCE OPERATIONS
// ============================================================================

/**
 * Get resource by ID
 */
export async function getResource(resourceId: string): Promise<Resource | null> {
	const resourceDoc = await getDoc(doc(db, 'resources', resourceId));
	if (!resourceDoc.exists()) return null;
	return { id: resourceDoc.id, ...resourceDoc.data() } as Resource;
}

/**
 * Get all resources
 */
export async function getAllResources(): Promise<Resource[]> {
	const resourcesSnapshot = await getDocs(collection(db, 'resources'));
	return resourcesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Resource);
}

/**
 * Create a new resource
 */
export async function createResource(resourceData: CreateResourceInput): Promise<string> {
	const docRef = await addDoc(collection(db, 'resources'), resourceData);
	return docRef.id;
}

/**
 * Update resource
 */
export async function updateResource(
	resourceId: string,
	updates: Partial<Resource>
): Promise<void> {
	await updateDoc(doc(db, 'resources', resourceId), updates);
}

/**
 * Delete resource
 */
export async function deleteResource(resourceId: string): Promise<void> {
	await deleteDoc(doc(db, 'resources', resourceId));
}

// ============================================================================
// ASSIGNED WORK ORDERS (Subcollection under Resources)
// ============================================================================

/**
 * Get assigned work orders for a resource
 */
export async function getAssignedWorkOrders(resourceId: string): Promise<AssignedWorkOrder[]> {
	const assignedWOsSnapshot = await getDocs(
		query(
			collection(db, 'resources', resourceId, 'assignedWorkOrders'),
			orderBy('position', 'asc')
		)
	);
	return assignedWOsSnapshot.docs.map((doc) => doc.data() as AssignedWorkOrder);
}

/**
 * Add work order to resource's assigned list
 */
export async function addAssignedWorkOrder(
	resourceId: string,
	assignment: AssignedWorkOrder
): Promise<void> {
	await updateDoc(
		doc(db, 'resources', resourceId, 'assignedWorkOrders', assignment.workOrderId),
		{
			...assignment,
			addedAt: serverTimestamp()
		}
	);
}

/**
 * Remove work order from resource's assigned list
 */
export async function removeAssignedWorkOrder(
	resourceId: string,
	workOrderId: string
): Promise<void> {
	await deleteDoc(doc(db, 'resources', resourceId, 'assignedWorkOrders', workOrderId));
}

/**
 * Update position of assigned work order
 */
export async function updateAssignedWorkOrderPosition(
	resourceId: string,
	workOrderId: string,
	newPosition: number
): Promise<void> {
	await updateDoc(doc(db, 'resources', resourceId, 'assignedWorkOrders', workOrderId), {
		position: newPosition
	});
}

// ============================================================================
// SCHEDULED DOWNTIME (Subcollection under Resources)
// ============================================================================

/**
 * Get scheduled downtime for a resource
 */
export async function getScheduledDowntime(resourceId: string): Promise<ScheduledDowntime[]> {
	const downtimeSnapshot = await getDocs(
		query(collection(db, 'resources', resourceId, 'scheduledDowntime'), orderBy('startTime', 'asc'))
	);
	return downtimeSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ScheduledDowntime);
}

/**
 * Add scheduled downtime
 */
export async function addScheduledDowntime(
	resourceId: string,
	downtime: Omit<ScheduledDowntime, 'id'>
): Promise<string> {
	const docRef = await addDoc(collection(db, 'resources', resourceId, 'scheduledDowntime'), downtime);
	return docRef.id;
}

/**
 * Delete scheduled downtime
 */
export async function deleteScheduledDowntime(
	resourceId: string,
	downtimeId: string
): Promise<void> {
	await deleteDoc(doc(db, 'resources', resourceId, 'scheduledDowntime', downtimeId));
}

// ============================================================================
// JOB OPERATIONS
// ============================================================================

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
	const jobDoc = await getDoc(doc(db, 'jobs', jobId));
	if (!jobDoc.exists()) return null;
	return { id: jobDoc.id, ...jobDoc.data() } as Job;
}

/**
 * Get all jobs
 */
export async function getAllJobs(): Promise<Job[]> {
	const jobsSnapshot = await getDocs(collection(db, 'jobs'));
	return jobsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Job);
}

/**
 * Get jobs by status
 */
export async function getJobsByStatus(status: string): Promise<Job[]> {
	const jobsSnapshot = await getDocs(
		query(collection(db, 'jobs'), where('status', '==', status))
	);
	return jobsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Job);
}

/**
 * Create a new job
 */
export async function createJob(jobData: CreateJobInput, createdBy: string): Promise<string> {
	const docRef = await addDoc(collection(db, 'jobs'), {
		...jobData,
		status: 'unassigned',
		createdBy,
		createdAt: serverTimestamp(),
		modifiedBy: createdBy,
		modifiedAt: serverTimestamp()
	});
	return docRef.id;
}

/**
 * Update job
 */
export async function updateJob(
	jobId: string,
	updates: Partial<Job>,
	modifiedBy: string
): Promise<void> {
	await updateDoc(doc(db, 'jobs', jobId), {
		...updates,
		modifiedBy,
		modifiedAt: serverTimestamp()
	});
}

/**
 * Delete job
 */
export async function deleteJob(jobId: string): Promise<void> {
	await deleteDoc(doc(db, 'jobs', jobId));
}

// ============================================================================
// WORK ORDER OPERATIONS (Subcollection under Jobs)
// ============================================================================

/**
 * Get work order by ID
 */
export async function getWorkOrder(jobId: string, workOrderId: string): Promise<WorkOrder | null> {
	const woDoc = await getDoc(doc(db, 'jobs', jobId, 'workOrders', workOrderId));
	if (!woDoc.exists()) return null;
	return { id: woDoc.id, ...woDoc.data() } as WorkOrder;
}

/**
 * Get all work orders for a job
 */
export async function getWorkOrdersForJob(jobId: string): Promise<WorkOrder[]> {
	const wosSnapshot = await getDocs(collection(db, 'jobs', jobId, 'workOrders'));
	return wosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as WorkOrder);
}

/**
 * Get work orders by resource
 */
export async function getWorkOrdersForResource(
	jobId: string,
	resourceId: string
): Promise<WorkOrder[]> {
	const wosSnapshot = await getDocs(
		query(collection(db, 'jobs', jobId, 'workOrders'), where('resourceId', '==', resourceId))
	);
	return wosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as WorkOrder);
}

/**
 * Create a work order
 */
export async function createWorkOrder(
	jobId: string,
	workOrderData: CreateWorkOrderInput,
	assignedBy: string
): Promise<string> {
	const docRef = await addDoc(collection(db, 'jobs', jobId, 'workOrders'), {
		...workOrderData,
		jobId,
		assignedBy,
		assignedAt: serverTimestamp()
	});
	return docRef.id;
}

/**
 * Update work order
 */
export async function updateWorkOrder(
	jobId: string,
	workOrderId: string,
	updates: Partial<WorkOrder>
): Promise<void> {
	await updateDoc(doc(db, 'jobs', jobId, 'workOrders', workOrderId), updates);
}

/**
 * Delete work order
 */
export async function deleteWorkOrder(jobId: string, workOrderId: string): Promise<void> {
	await deleteDoc(doc(db, 'jobs', jobId, 'workOrders', workOrderId));
}

// ============================================================================
// TIME ENTRY OPERATIONS (Subcollection under Work Orders)
// ============================================================================

/**
 * Get time entries for a work order
 */
export async function getTimeEntries(jobId: string, workOrderId: string): Promise<TimeEntry[]> {
	const entriesSnapshot = await getDocs(
		query(
			collection(db, 'jobs', jobId, 'workOrders', workOrderId, 'timeEntries'),
			orderBy('startTime', 'asc')
		)
	);
	return entriesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as TimeEntry);
}

/**
 * Create a time entry
 */
export async function createTimeEntry(
	jobId: string,
	workOrderId: string,
	userId: string
): Promise<string> {
	const docRef = await addDoc(
		collection(db, 'jobs', jobId, 'workOrders', workOrderId, 'timeEntries'),
		{
			startTime: serverTimestamp(),
			endTime: null,
			quantityCompleted: 0,
			userId
		}
	);
	return docRef.id;
}

/**
 * Update time entry (typically to set end time and quantity)
 */
export async function updateTimeEntry(
	jobId: string,
	workOrderId: string,
	timeEntryId: string,
	updates: Partial<TimeEntry>
): Promise<void> {
	await updateDoc(
		doc(db, 'jobs', jobId, 'workOrders', workOrderId, 'timeEntries', timeEntryId),
		updates
	);
}

/**
 * Close time entry (set end time)
 */
export async function closeTimeEntry(
	jobId: string,
	workOrderId: string,
	timeEntryId: string,
	quantityCompleted: number
): Promise<void> {
	await updateDoc(
		doc(db, 'jobs', jobId, 'workOrders', workOrderId, 'timeEntries', timeEntryId),
		{
			endTime: serverTimestamp(),
			quantityCompleted
		}
	);
}

// ============================================================================
// AUDIT LOG OPERATIONS
// ============================================================================

/**
 * Get audit log entries for a job
 */
export async function getAuditLogsForJob(jobId: string): Promise<AuditLogEntry[]> {
	// First get references from job's auditLog subcollection
	const refsSnapshot = await getDocs(collection(db, 'jobs', jobId, 'auditLog'));
	const globalIds = refsSnapshot.docs.map((doc) => doc.data().globalAuditLogId);

	// Then fetch the actual audit log entries
	const auditLogs: AuditLogEntry[] = [];
	for (const globalId of globalIds) {
		const logDoc = await getDoc(doc(db, 'auditLogs', globalId));
		if (logDoc.exists()) {
			auditLogs.push({ id: logDoc.id, ...logDoc.data() } as AuditLogEntry);
		}
	}

	// Sort by timestamp descending
	auditLogs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

	return auditLogs;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
	auditData: Omit<AuditLogEntry, 'id' | 'timestamp'>,
	userId: string
): Promise<string> {
	// Create global audit log entry
	const globalDocRef = await addDoc(collection(db, 'auditLogs'), {
		...auditData,
		userId,
		timestamp: serverTimestamp()
	});

	// Create reference in job's auditLog subcollection
	await addDoc(collection(db, 'jobs', auditData.jobId, 'auditLog'), {
		globalAuditLogId: globalDocRef.id
	});

	return globalDocRef.id;
}

/**
 * Get all audit logs (admin view)
 */
export async function getAllAuditLogs(limitCount = 100): Promise<AuditLogEntry[]> {
	const logsSnapshot = await getDocs(
		query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(limitCount))
	);
	return logsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AuditLogEntry);
}

// ============================================================================
// GANTT ENTRY OPERATIONS (Read-only for app, written by Cloud Functions)
// ============================================================================

/**
 * Get gantt entries for date range
 */
export async function getGanttEntriesForDateRange(
	startDate: Timestamp,
	endDate: Timestamp
): Promise<GanttEntry[]> {
	const entriesSnapshot = await getDocs(
		query(
			collection(db, 'ganttEntries'),
			where('scheduledStart', '>=', startDate),
			where('scheduledEnd', '<=', endDate),
			orderBy('scheduledStart', 'asc')
		)
	);
	return entriesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as GanttEntry);
}

/**
 * Get gantt entries for a specific resource
 */
export async function getGanttEntriesForResource(resourceId: string): Promise<GanttEntry[]> {
	const entriesSnapshot = await getDocs(
		query(
			collection(db, 'ganttEntries'),
			where('resourceId', '==', resourceId),
			orderBy('scheduledStart', 'asc')
		)
	);
	return entriesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as GanttEntry);
}

/**
 * Get all gantt entries
 */
export async function getAllGanttEntries(): Promise<GanttEntry[]> {
	const entriesSnapshot = await getDocs(
		query(collection(db, 'ganttEntries'), orderBy('scheduledStart', 'asc'))
	);
	return entriesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as GanttEntry);
}

// ============================================================================
// CONFIGURATION OPERATIONS
// ============================================================================

/**
 * Get Production Queue configuration
 */
export async function getProductionQueueConfig(): Promise<ProductionQueueConfig | null> {
	const configDoc = await getDoc(doc(db, 'configuration', 'productionQueue'));
	if (!configDoc.exists()) return null;
	return configDoc.data() as ProductionQueueConfig;
}

/**
 * Update Production Queue configuration
 */
export async function updateProductionQueueConfig(
	config: Partial<ProductionQueueConfig>
): Promise<void> {
	await updateDoc(doc(db, 'configuration', 'productionQueue'), config);
}

/**
 * Get System configuration
 */
export async function getSystemConfig(): Promise<SystemConfig | null> {
	const configDoc = await getDoc(doc(db, 'configuration', 'system'));
	if (!configDoc.exists()) return null;
	return configDoc.data() as SystemConfig;
}

/**
 * Update System configuration
 */
export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<void> {
	await updateDoc(doc(db, 'configuration', 'system'), config);
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Generic query builder for flexible filtering
 */
export async function queryCollection<T>(
	collectionPath: string,
	filters: Array<{ field: string; operator: WhereFilterOp; value: any }> = [],
	orderByField?: string,
	orderDirection: OrderByDirection = 'asc',
	limitCount?: number
): Promise<T[]> {
	let q = collection(db, collectionPath);
	let queryRef = query(q);

	// Apply filters
	for (const filter of filters) {
		queryRef = query(queryRef, where(filter.field, filter.operator, filter.value));
	}

	// Apply ordering
	if (orderByField) {
		queryRef = query(queryRef, orderBy(orderByField, orderDirection));
	}

	// Apply limit
	if (limitCount) {
		queryRef = query(queryRef, limit(limitCount));
	}

	const snapshot = await getDocs(queryRef);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T);
}
