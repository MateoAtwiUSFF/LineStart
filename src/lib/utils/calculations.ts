/**
 * Calculation utilities for LineStart
 * Includes duration formulas and time-related helper functions
 */

import type { Timestamp } from 'firebase/firestore';
import type { OperationalHours } from '$lib/types';

/**
 * Calculate estimated duration for a work order
 *
 * Formula: estimatedDuration = setupTime + (quantity / defaultProductionRate)
 *
 * @param setupTime - Setup time in minutes
 * @param quantity - Number of units to produce
 * @param productionRate - Units per hour
 * @returns Estimated duration in minutes
 *
 * @example
 * calculateDuration(15, 100, 30)
 * // Returns: 15 + (100 / 30) * 60 = 15 + 200 = 215 minutes
 */
export function calculateDuration(
	setupTime: number,
	quantity: number,
	productionRate: number
): number {
	if (productionRate <= 0) {
		throw new Error('Production rate must be greater than 0');
	}

	// Convert production rate (units/hour) to time per unit (minutes)
	const minutesPerUnit = 60 / productionRate;

	// Total duration = setup time + (quantity * minutes per unit)
	const estimatedDuration = setupTime + quantity * minutesPerUnit;

	return Math.round(estimatedDuration);
}

/**
 * Calculate scheduled end time based on start time and duration
 *
 * @param startTime - Start timestamp
 * @param durationMinutes - Duration in minutes
 * @returns End timestamp
 */
export function calculateEndTime(startTime: Date, durationMinutes: number): Date {
	const endTime = new Date(startTime);
	endTime.setMinutes(endTime.getMinutes() + durationMinutes);
	return endTime;
}

/**
 * Convert Firestore Timestamp to Date
 *
 * @param timestamp - Firestore Timestamp
 * @returns JavaScript Date object
 */
export function timestampToDate(timestamp: Timestamp): Date {
	return timestamp.toDate();
}

/**
 * Convert Date to Firestore Timestamp
 * Note: This creates a plain object with seconds/nanoseconds
 * When writing to Firestore, use serverTimestamp() or Timestamp.fromDate()
 *
 * @param date - JavaScript Date object
 * @returns Plain object compatible with Firestore
 */
export function dateToTimestamp(date: Date): { seconds: number; nanoseconds: number } {
	const seconds = Math.floor(date.getTime() / 1000);
	const nanoseconds = (date.getTime() % 1000) * 1000000;
	return { seconds, nanoseconds };
}

/**
 * Format duration in minutes to human-readable string
 *
 * @param minutes - Duration in minutes
 * @returns Formatted string (e.g., "2h 30m", "45m", "1d 3h 15m")
 */
export function formatDuration(minutes: number): string {
	if (minutes < 60) {
		return `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;

	if (hours < 24) {
		return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
	}

	const days = Math.floor(hours / 24);
	const remainingHours = hours % 24;

	let result = `${days}d`;
	if (remainingHours > 0) result += ` ${remainingHours}h`;
	if (remainingMinutes > 0) result += ` ${remainingMinutes}m`;

	return result;
}

/**
 * Format timestamp to readable date string
 *
 * @param timestamp - Firestore Timestamp
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: Timestamp, includeTime = true): string {
	const date = timestampToDate(timestamp);

	if (includeTime) {
		return date.toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Check if a given time falls within operational hours
 *
 * @param date - Date to check
 * @param operationalHours - Resource operational hours
 * @returns True if within operational hours, false otherwise
 */
export function isWithinOperationalHours(date: Date, operationalHours: OperationalHours): boolean {
	const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

	// Check if day is in operational days
	if (!operationalHours.daysOfWeek.includes(dayOfWeek)) {
		return false;
	}

	// Parse start and end times (format: "HH:MM")
	const [startHour, startMinute] = operationalHours.startTime.split(':').map(Number);
	const [endHour, endMinute] = operationalHours.endTime.split(':').map(Number);

	const currentHour = date.getHours();
	const currentMinute = date.getMinutes();
	const currentTotalMinutes = currentHour * 60 + currentMinute;
	const startTotalMinutes = startHour * 60 + startMinute;
	const endTotalMinutes = endHour * 60 + endMinute;

	return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
}

/**
 * Calculate the next available start time based on operational hours
 *
 * @param startTime - Desired start time
 * @param operationalHours - Resource operational hours
 * @returns Adjusted start time within operational hours
 */
export function getNextAvailableStartTime(
	startTime: Date,
	operationalHours: OperationalHours
): Date {
	const adjustedTime = new Date(startTime);

	// If already within operational hours, return as-is
	if (isWithinOperationalHours(adjustedTime, operationalHours)) {
		return adjustedTime;
	}

	// Find next operational day
	let daysChecked = 0;
	while (daysChecked < 14) {
		// Check up to 2 weeks ahead
		adjustedTime.setDate(adjustedTime.getDate() + 1);
		adjustedTime.setHours(0, 0, 0, 0); // Reset to start of day

		const dayOfWeek = adjustedTime.getDay();
		if (operationalHours.daysOfWeek.includes(dayOfWeek)) {
			// Set to start of operational hours
			const [startHour, startMinute] = operationalHours.startTime.split(':').map(Number);
			adjustedTime.setHours(startHour, startMinute, 0, 0);
			return adjustedTime;
		}

		daysChecked++;
	}

	// Fallback: return original time if no operational day found
	return startTime;
}

/**
 * Calculate total elapsed time from time entries
 *
 * @param timeEntries - Array of time entries with start and end times
 * @returns Total elapsed time in minutes
 */
export function calculateTotalElapsedTime(
	timeEntries: Array<{ startTime: Timestamp; endTime: Timestamp | null }>
): number {
	let totalMinutes = 0;

	for (const entry of timeEntries) {
		if (entry.endTime) {
			const start = timestampToDate(entry.startTime);
			const end = timestampToDate(entry.endTime);
			const elapsedMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
			totalMinutes += elapsedMinutes;
		}
	}

	return Math.round(totalMinutes);
}

/**
 * Parse time string to hours and minutes
 *
 * @param timeString - Time in format "HH:MM"
 * @returns Object with hours and minutes
 */
export function parseTimeString(timeString: string): { hours: number; minutes: number } {
	const [hours, minutes] = timeString.split(':').map(Number);
	return { hours, minutes };
}

/**
 * Format time as HH:MM string
 *
 * @param hours - Hours (0-23)
 * @param minutes - Minutes (0-59)
 * @returns Time string in format "HH:MM"
 */
export function formatTimeString(hours: number, minutes: number): string {
	const h = hours.toString().padStart(2, '0');
	const m = minutes.toString().padStart(2, '0');
	return `${h}:${m}`;
}

/**
 * Add minutes to a time string
 *
 * @param timeString - Time in format "HH:MM"
 * @param minutesToAdd - Minutes to add
 * @returns New time string in format "HH:MM"
 */
export function addMinutesToTimeString(timeString: string, minutesToAdd: number): string {
	const { hours, minutes } = parseTimeString(timeString);
	const totalMinutes = hours * 60 + minutes + minutesToAdd;

	const newHours = Math.floor(totalMinutes / 60) % 24;
	const newMinutes = totalMinutes % 60;

	return formatTimeString(newHours, newMinutes);
}
