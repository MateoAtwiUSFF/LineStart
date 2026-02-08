/**
 * CSV import/export utilities for LineStart
 * Handles CSV parsing, validation, and generation for Production Queue
 */

import type { Job, CustomField, ProductionQueueConfig } from '$lib/types';
import { createJob } from './firestore';

/**
 * Parse CSV content to array of objects
 *
 * @param csvContent - Raw CSV string
 * @returns Array of row objects with column headers as keys
 */
export function parseCSV(csvContent: string): Record<string, string>[] {
	const lines = csvContent.trim().split('\n');
	if (lines.length < 2) {
		throw new Error('CSV must have at least a header row and one data row');
	}

	// Parse header row
	const headers = parseCSVLine(lines[0]);

	// Parse data rows
	const rows: Record<string, string>[] = [];
	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i]);
		if (values.length !== headers.length) {
			throw new Error(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}`);
		}

		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = values[j];
		}
		rows.push(row);
	}

	return rows;
}

/**
 * Parse a single CSV line handling quoted values
 *
 * @param line - CSV line string
 * @returns Array of cell values
 */
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				// Escaped quote
				current += '"';
				i++; // Skip next quote
			} else {
				// Toggle quote state
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			// End of field
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	// Add last field
	result.push(current.trim());

	return result;
}

/**
 * Validate CSV headers against required fields
 *
 * @param headers - CSV column headers
 * @param config - Production Queue configuration
 * @returns Validation result with errors if any
 */
export function validateCSVHeaders(
	headers: string[],
	config: ProductionQueueConfig
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Required base fields
	const requiredFields = ['projectId', 'quantity'];
	for (const field of requiredFields) {
		if (!headers.includes(field)) {
			errors.push(`Missing required column: ${field}`);
		}
	}

	// Required custom fields
	const requiredCustomFields = config.customFields.filter((f) => f.required);
	for (const field of requiredCustomFields) {
		if (!headers.includes(field.name)) {
			errors.push(`Missing required custom field: ${field.name}`);
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Convert CSV row to job data
 *
 * @param row - CSV row object
 * @param config - Production Queue configuration
 * @returns Job data ready for creation
 */
export function csvRowToJobData(
	row: Record<string, string>,
	config: ProductionQueueConfig
): { projectId: string; quantity: number; customFieldValues: Record<string, any> } {
	// Parse base fields
	const projectId = row.projectId?.trim() || '';
	const quantity = parseInt(row.quantity) || 0;

	if (!projectId) {
		throw new Error('projectId is required');
	}
	if (quantity <= 0) {
		throw new Error('quantity must be greater than 0');
	}

	// Parse custom fields
	const customFieldValues: Record<string, any> = {};
	for (const field of config.customFields) {
		const value = row[field.name];

		if (field.required && !value) {
			throw new Error(`Required field "${field.name}" is missing`);
		}

		if (value) {
			// Convert value based on field type
			switch (field.type) {
				case 'number':
					customFieldValues[field.name] = parseFloat(value);
					if (isNaN(customFieldValues[field.name])) {
						throw new Error(`Field "${field.name}" must be a number`);
					}
					break;
				case 'boolean':
					customFieldValues[field.name] =
						value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
					break;
				case 'date':
					customFieldValues[field.name] = new Date(value).toISOString();
					if (isNaN(new Date(customFieldValues[field.name]).getTime())) {
						throw new Error(`Field "${field.name}" is not a valid date`);
					}
					break;
				case 'string':
				default:
					customFieldValues[field.name] = value;
			}
		} else if (field.defaultValue !== undefined) {
			customFieldValues[field.name] = field.defaultValue;
		}
	}

	return { projectId, quantity, customFieldValues };
}

/**
 * Import jobs from CSV
 *
 * @param csvContent - Raw CSV string
 * @param config - Production Queue configuration
 * @param userId - ID of user performing the import
 * @returns Result with created job IDs and any errors
 */
export async function importJobsFromCSV(
	csvContent: string,
	config: ProductionQueueConfig,
	userId: string
): Promise<{ success: string[]; errors: Array<{ row: number; error: string }> }> {
	const success: string[] = [];
	const errors: Array<{ row: number; error: string }> = [];

	try {
		// Parse CSV
		const rows = parseCSV(csvContent);
		if (rows.length === 0) {
			throw new Error('No data rows found in CSV');
		}

		// Validate headers
		const headers = Object.keys(rows[0]);
		const validation = validateCSVHeaders(headers, config);
		if (!validation.valid) {
			throw new Error(validation.errors.join('; '));
		}

		// Process each row
		for (let i = 0; i < rows.length; i++) {
			try {
				const jobData = csvRowToJobData(rows[i], config);
				const jobId = await createJob(jobData, userId);
				success.push(jobId);
			} catch (error) {
				errors.push({
					row: i + 2, // +2 because: +1 for header row, +1 for 1-based indexing
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}
	} catch (error) {
		// CSV parsing or validation error
		errors.push({
			row: 0,
			error: error instanceof Error ? error.message : 'Failed to parse CSV'
		});
	}

	return { success, errors };
}

/**
 * Export jobs to CSV
 *
 * @param jobs - Array of jobs to export
 * @param config - Production Queue configuration
 * @returns CSV string
 */
export function exportJobsToCSV(jobs: Job[], config: ProductionQueueConfig): string {
	if (jobs.length === 0) {
		return 'projectId,quantity,status';
	}

	// Build header row
	const baseHeaders = ['projectId', 'quantity', 'status'];
	const customHeaders = config.customFields.map((f) => f.name);
	const headers = [...baseHeaders, ...customHeaders];

	// Build data rows
	const rows = jobs.map((job) => {
		const baseValues = [job.projectId, job.quantity.toString(), job.status];

		const customValues = config.customFields.map((field) => {
			const value = job.customFieldValues[field.name];
			if (value === undefined || value === null) return '';

			// Format value based on type
			switch (field.type) {
				case 'boolean':
					return value ? 'true' : 'false';
				case 'date':
					return new Date(value).toISOString().split('T')[0]; // YYYY-MM-DD
				default:
					return String(value);
			}
		});

		return [...baseValues, ...customValues];
	});

	// Combine headers and rows
	const allRows = [headers, ...rows];

	// Convert to CSV string
	return allRows.map((row) => row.map((cell) => escapeCSVCell(cell)).join(',')).join('\n');
}

/**
 * Escape CSV cell value (add quotes if needed, escape internal quotes)
 *
 * @param value - Cell value
 * @returns Escaped cell value
 */
function escapeCSVCell(value: string): string {
	// Check if value needs quoting (contains comma, quote, or newline)
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		// Escape internal quotes by doubling them
		const escaped = value.replace(/"/g, '""');
		return `"${escaped}"`;
	}
	return value;
}

/**
 * Download CSV file in browser
 *
 * @param csvContent - CSV string content
 * @param filename - Name of file to download
 */
export function downloadCSV(csvContent: string, filename: string): void {
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	const url = URL.createObjectURL(blob);

	link.setAttribute('href', url);
	link.setAttribute('download', filename);
	link.style.visibility = 'hidden';

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Clean up URL object
	URL.revokeObjectURL(url);
}

/**
 * Generate sample CSV template based on configuration
 *
 * @param config - Production Queue configuration
 * @returns Sample CSV string with headers and one example row
 */
export function generateCSVTemplate(config: ProductionQueueConfig): string {
	const baseHeaders = ['projectId', 'quantity'];
	const customHeaders = config.customFields.map((f) => f.name);
	const headers = [...baseHeaders, ...customHeaders];

	// Create example row
	const exampleRow = [
		'PROJECT-001',
		'100',
		...config.customFields.map((field) => {
			switch (field.type) {
				case 'number':
					return '10';
				case 'boolean':
					return 'true';
				case 'date':
					return new Date().toISOString().split('T')[0];
				case 'string':
				default:
					return 'Example';
			}
		})
	];

	return [headers.join(','), exampleRow.join(',')].join('\n');
}
