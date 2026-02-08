/**
 * Firebase Cloud Messaging (FCM) utilities for LineStart
 * Handles notification permissions, token management, and message handling
 */

import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getMessagingInstance } from '$lib/firebase';
import { updateUser } from './firestore';

/**
 * Request notification permission from the user
 *
 * @returns True if permission granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
	if (!('Notification' in window)) {
		console.warn('This browser does not support notifications');
		return false;
	}

	const permission = await Notification.requestPermission();
	return permission === 'granted';
}

/**
 * Get FCM registration token
 *
 * @param vapidKey - VAPID public key from Firebase Console
 * @returns FCM token or null if not available
 */
export async function getFCMToken(vapidKey: string): Promise<string | null> {
	try {
		const messaging = getMessagingInstance();
		if (!messaging) {
			console.warn('Firebase Messaging is not supported in this environment');
			return null;
		}

		const hasPermission = await requestNotificationPermission();
		if (!hasPermission) {
			console.warn('Notification permission denied');
			return null;
		}

		const token = await getToken(messaging, { vapidKey });
		return token;
	} catch (error) {
		console.error('Failed to get FCM token:', error);
		return null;
	}
}

/**
 * Save FCM token to user document
 *
 * @param userId - User ID
 * @param token - FCM token
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
	try {
		await updateUser(userId, { fcmToken: token }, userId);
	} catch (error) {
		console.error('Failed to save FCM token:', error);
		throw error;
	}
}

/**
 * Register FCM token for the current user
 *
 * @param userId - User ID
 * @param vapidKey - VAPID public key
 * @returns True if successful, false otherwise
 */
export async function registerFCMToken(userId: string, vapidKey: string): Promise<boolean> {
	try {
		const token = await getFCMToken(vapidKey);
		if (!token) {
			return false;
		}

		await saveFCMToken(userId, token);
		return true;
	} catch (error) {
		console.error('Failed to register FCM token:', error);
		return false;
	}
}

/**
 * Set up foreground message listener
 *
 * @param onMessageReceived - Callback function to handle received messages
 */
export function setupForegroundMessageHandler(
	onMessageReceived: (payload: MessagePayload) => void
): void {
	const messaging = getMessagingInstance();
	if (!messaging) {
		console.warn('Firebase Messaging is not supported');
		return;
	}

	onMessage(messaging, (payload) => {
		console.log('Foreground message received:', payload);
		onMessageReceived(payload);
	});
}

/**
 * Show browser notification
 *
 * @param title - Notification title
 * @param options - Notification options
 */
export function showNotification(title: string, options?: NotificationOptions): void {
	if (!('Notification' in window)) {
		console.warn('This browser does not support notifications');
		return;
	}

	if (Notification.permission === 'granted') {
		new Notification(title, options);
	}
}

/**
 * Display notification from FCM payload
 *
 * @param payload - FCM message payload
 */
export function displayFCMNotification(payload: MessagePayload): void {
	const title = payload.notification?.title || 'LineStart Notification';
	const body = payload.notification?.body || '';
	const icon = payload.notification?.icon || '/favicon.png';

	showNotification(title, {
		body,
		icon,
		badge: '/favicon.png',
		tag: payload.messageId,
		data: payload.data
	});
}

/**
 * Notification types for LineStart
 */
export enum NotificationType {
	WORK_ORDER_ASSIGNED = 'work_order_assigned',
	DOWNTIME_REPORTED = 'downtime_reported',
	DOWNTIME_CLEARED = 'downtime_cleared',
	JOB_COMPLETED = 'job_completed',
	PARTIAL_COMPLETION = 'partial_completion'
}

/**
 * Create notification data for work order assignment
 *
 * @param jobId - Job ID
 * @param workOrderId - Work order ID
 * @param resourceName - Name of assigned resource
 * @returns Notification data
 */
export function createWorkOrderAssignedNotification(
	jobId: string,
	workOrderId: string,
	resourceName: string
): { title: string; body: string; data: Record<string, string> } {
	return {
		title: 'New Work Order Assigned',
		body: `Work order for job ${jobId} has been assigned to ${resourceName}`,
		data: {
			type: NotificationType.WORK_ORDER_ASSIGNED,
			jobId,
			workOrderId,
			resourceName
		}
	};
}

/**
 * Create notification data for downtime report
 *
 * @param resourceName - Name of resource experiencing downtime
 * @param reason - Reason for downtime
 * @returns Notification data
 */
export function createDowntimeReportedNotification(
	resourceName: string,
	reason: string
): { title: string; body: string; data: Record<string, string> } {
	return {
		title: 'Downtime Reported',
		body: `${resourceName} is experiencing downtime: ${reason}`,
		data: {
			type: NotificationType.DOWNTIME_REPORTED,
			resourceName,
			reason
		}
	};
}

/**
 * Create notification data for downtime clearance
 *
 * @param resourceName - Name of resource
 * @returns Notification data
 */
export function createDowntimeClearedNotification(
	resourceName: string
): { title: string; body: string; data: Record<string, string> } {
	return {
		title: 'Downtime Cleared',
		body: `${resourceName} is back online`,
		data: {
			type: NotificationType.DOWNTIME_CLEARED,
			resourceName
		}
	};
}

/**
 * Create notification data for job completion
 *
 * @param jobId - Job ID
 * @param projectId - Project ID
 * @returns Notification data
 */
export function createJobCompletedNotification(
	jobId: string,
	projectId: string
): { title: string; body: string; data: Record<string, string> } {
	return {
		title: 'Job Completed',
		body: `Job ${projectId} has been completed`,
		data: {
			type: NotificationType.JOB_COMPLETED,
			jobId,
			projectId
		}
	};
}

/**
 * Create notification data for partial completion
 *
 * @param jobId - Job ID
 * @param projectId - Project ID
 * @param completedQuantity - Quantity completed
 * @param remainingQuantity - Quantity remaining
 * @returns Notification data
 */
export function createPartialCompletionNotification(
	jobId: string,
	projectId: string,
	completedQuantity: number,
	remainingQuantity: number
): { title: string; body: string; data: Record<string, string> } {
	return {
		title: 'Partial Completion',
		body: `Job ${projectId}: ${completedQuantity} units completed, ${remainingQuantity} remaining`,
		data: {
			type: NotificationType.PARTIAL_COMPLETION,
			jobId,
			projectId,
			completedQuantity: completedQuantity.toString(),
			remainingQuantity: remainingQuantity.toString()
		}
	};
}

/**
 * Check if browser supports notifications
 *
 * @returns True if notifications are supported
 */
export function isNotificationSupported(): boolean {
	return 'Notification' in window;
}

/**
 * Check current notification permission status
 *
 * @returns Current permission status
 */
export function getNotificationPermissionStatus(): NotificationPermission {
	if (!isNotificationSupported()) {
		return 'denied';
	}
	return Notification.permission;
}

/**
 * Play notification sound (optional enhancement)
 */
export function playNotificationSound(): void {
	// Create and play a simple beep sound
	const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
	const oscillator = audioContext.createOscillator();
	const gainNode = audioContext.createGain();

	oscillator.connect(gainNode);
	gainNode.connect(audioContext.destination);

	oscillator.frequency.value = 800;
	oscillator.type = 'sine';

	gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
	gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

	oscillator.start(audioContext.currentTime);
	oscillator.stop(audioContext.currentTime + 0.3);
}
