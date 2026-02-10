/**
 * Cloud Functions for LineStart
 *
 * This file contains all Firebase Cloud Functions including:
 * - onWorkOrderWrite: Maintain ganttEntries when work orders change
 * - onResourceUpdate: Update ganttEntries when resource downtime changes
 * - sendNotification: Callable function for sending FCM notifications
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// ============================================================================
// TYPES
// ============================================================================

interface WorkOrder {
	id: string;
	jobId: string;
	resourceId: string;
	type: 'production' | 'downtime';
	priority: 'high' | 'normal' | 'none';
	status: 'queued' | 'active' | 'paused' | 'completed' | 'partial';
	quantityTarget: number;
	quantityCompleted: number;
	estimatedDuration: number;
	scheduledStart: admin.firestore.Timestamp | null;
	createdAt: admin.firestore.Timestamp;
	createdBy: string;
	modifiedAt: admin.firestore.Timestamp;
	modifiedBy: string;
	completedAt?: admin.firestore.Timestamp | null;
	completedBy?: string | null;
}

interface GanttEntry {
	id: string;
	jobId: string;
	workOrderId: string;
	resourceId: string;
	resourceName: string;
	type: 'production' | 'downtime';
	status: 'queued' | 'active' | 'paused' | 'completed' | 'partial';
	startTime: admin.firestore.Timestamp;
	endTime: admin.firestore.Timestamp;
	duration: number;
	quantityTarget: number;
	quantityCompleted: number;
	createdAt: admin.firestore.Timestamp;
	modifiedAt: admin.firestore.Timestamp;
}

interface Resource {
	id: string;
	name: string;
	uid: string;
	currentDowntime?: {
		isDown: boolean;
		startTime: admin.firestore.Timestamp | null;
		reason: string | null;
	};
}

// ============================================================================
// WORK ORDER TRIGGERS
// ============================================================================

/**
 * Trigger: When a work order is created or updated
 * Action: Create or update corresponding ganttEntry
 */
export const onWorkOrderWrite = functions.firestore
	.document('jobs/{jobId}/workOrders/{workOrderId}')
	.onWrite(async (change, context) => {
		const { jobId, workOrderId } = context.params;

		try {
			// If document was deleted, delete the ganttEntry
			if (!change.after.exists) {
				await db.collection('ganttEntries').doc(workOrderId).delete();
				console.log(`Deleted ganttEntry for work order ${workOrderId}`);
				return null;
			}

			const workOrder = change.after.data() as WorkOrder;

			// Skip if work order has no resource assigned (unassigned/queued without resource)
			if (!workOrder.resourceId) {
				console.log(`Work order ${workOrderId} has no resource, skipping ganttEntry`);
				return null;
			}

			// Get resource details
			const resourceDoc = await db.collection('resources').doc(workOrder.resourceId).get();
			if (!resourceDoc.exists) {
				console.error(`Resource ${workOrder.resourceId} not found for work order ${workOrderId}`);
				return null;
			}

			const resource = resourceDoc.data() as Resource;

			// Calculate start and end times
			const startTime = workOrder.scheduledStart || workOrder.createdAt;
			const endTime = new admin.firestore.Timestamp(
				startTime.seconds + workOrder.estimatedDuration * 60,
				startTime.nanoseconds
			);

			// Create or update ganttEntry
			const ganttEntry: GanttEntry = {
				id: workOrderId,
				jobId,
				workOrderId,
				resourceId: workOrder.resourceId,
				resourceName: resource.name,
				type: workOrder.type,
				status: workOrder.status,
				startTime,
				endTime,
				duration: workOrder.estimatedDuration,
				quantityTarget: workOrder.quantityTarget,
				quantityCompleted: workOrder.quantityCompleted,
				createdAt: workOrder.createdAt,
				modifiedAt: admin.firestore.Timestamp.now()
			};

			await db.collection('ganttEntries').doc(workOrderId).set(ganttEntry, { merge: true });
			console.log(`Updated ganttEntry for work order ${workOrderId}`);

			return null;
		} catch (error) {
			console.error(`Error updating ganttEntry for work order ${workOrderId}:`, error);
			return null;
		}
	});

// ============================================================================
// RESOURCE TRIGGERS
// ============================================================================

/**
 * Trigger: When a resource is updated (downtime changes)
 * Action: Push forward all scheduled work orders if downtime is reported
 */
export const onResourceUpdate = functions.firestore
	.document('resources/{resourceId}')
	.onUpdate(async (change, context) => {
		const { resourceId } = context.params;

		try {
			const before = change.before.data() as Resource;
			const after = change.after.data() as Resource;

			// Check if downtime status changed
			const wasDown = before.currentDowntime?.isDown || false;
			const isDown = after.currentDowntime?.isDown || false;

			// Only act if downtime status changed
			if (wasDown === isDown) {
				return null;
			}

			if (isDown) {
				// Downtime reported - push forward all queued work orders
				console.log(`Downtime reported for resource ${resourceId}, pushing work orders`);

				// Get all queued work orders for this resource
				const workOrdersSnapshot = await db
					.collectionGroup('workOrders')
					.where('resourceId', '==', resourceId)
					.where('status', '==', 'queued')
					.get();

				// Note: In a real implementation, we would calculate the push duration
				// based on the downtime window. For MVP, we log the action but don't
				// automatically reschedule - PM will manually redistribute if needed.
				console.log(`Found ${workOrdersSnapshot.size} work orders to potentially reschedule`);

				// In production, you might create notifications here for PMs
			} else {
				// Downtime cleared
				console.log(`Downtime cleared for resource ${resourceId}`);
			}

			return null;
		} catch (error) {
			console.error(`Error handling resource update for ${resourceId}:`, error);
			return null;
		}
	});

// ============================================================================
// AUDIT LOG TRIGGER
// ============================================================================

/**
 * Trigger: When an audit log entry is created
 * Action: Add reference to job's audit log subcollection
 */
export const onAuditLogCreated = functions.firestore
	.document('auditLogs/{auditLogId}')
	.onCreate(async (snap, context) => {
		const { auditLogId } = context.params;

		try {
			const auditLog = snap.data();

			// If audit log has a jobId, create a reference in the job's auditLog subcollection
			if (auditLog.jobId) {
				await db
					.collection('jobs')
					.doc(auditLog.jobId)
					.collection('auditLog')
					.doc(auditLogId)
					.set({
						auditLogRef: db.collection('auditLogs').doc(auditLogId),
						timestamp: auditLog.timestamp,
						action: auditLog.action
					});

				console.log(`Created audit log reference for job ${auditLog.jobId}`);
			}

			return null;
		} catch (error) {
			console.error(`Error creating audit log reference:`, error);
			return null;
		}
	});

// ============================================================================
// CALLABLE FUNCTIONS
// ============================================================================

/**
 * Callable: Send FCM notification to user(s)
 * Input: { userIds: string[], title: string, body: string, data?: object }
 */
export const sendNotification = functions.https.onCall(async (data, context) => {
	// Verify authenticated
	if (!context.auth) {
		throw new functions.https.HttpsError(
			'unauthenticated',
			'User must be authenticated to send notifications'
		);
	}

	const { userIds, title, body, data: notificationData } = data;

	// Validate input
	if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
		throw new functions.https.HttpsError('invalid-argument', 'userIds must be a non-empty array');
	}

	if (!title || !body) {
		throw new functions.https.HttpsError('invalid-argument', 'title and body are required');
	}

	try {
		// Get FCM tokens for all users
		const tokens: string[] = [];

		for (const userId of userIds) {
			const userDoc = await db.collection('users').doc(userId).get();
			if (userDoc.exists) {
				const userData = userDoc.data();
				if (userData?.fcmToken) {
					tokens.push(userData.fcmToken);
				}
			}
		}

		if (tokens.length === 0) {
			console.log('No FCM tokens found for users:', userIds);
			return { success: true, sentCount: 0 };
		}

		// Send notification
		const message: admin.messaging.MulticastMessage = {
			notification: {
				title,
				body
			},
			data: notificationData || {},
			tokens
		};

		const response = await admin.messaging().sendEachForMulticast(message);

		console.log(`Sent ${response.successCount} notifications, ${response.failureCount} failed`);

		return {
			success: true,
			sentCount: response.successCount,
			failedCount: response.failureCount
		};
	} catch (error) {
		console.error('Error sending notification:', error);
		throw new functions.https.HttpsError('internal', 'Failed to send notification');
	}
});
