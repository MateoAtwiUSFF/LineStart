/**
 * Jobs store for Production Queue
 * Manages job data, filtering, and sorting
 */

import { writable, derived, type Readable } from 'svelte/store';
import { getAllJobs, createJob, updateJob, deleteJob } from '$lib/utils/firestore';
import type { Job } from '$lib/types';

// ============================================================================
// STORE
// ============================================================================

interface JobsState {
	jobs: Job[];
	loading: boolean;
	error: string | null;
	filter: string;
	sortBy: string;
	sortDirection: 'asc' | 'desc';
}

const createJobsStore = () => {
	const { subscribe, set, update } = writable<JobsState>({
		jobs: [],
		loading: false,
		error: null,
		filter: '',
		sortBy: 'createdAt',
		sortDirection: 'desc'
	});

	return {
		subscribe,

		/**
		 * Load all jobs from Firestore
		 */
		load: async () => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const jobs = await getAllJobs();
				update((state) => ({ ...state, jobs, loading: false }));
			} catch (error: any) {
				console.error('Error loading jobs:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to load jobs'
				}));
			}
		},

		/**
		 * Create a new job
		 */
		create: async (jobData: {
			projectId: string;
			quantity: number;
			customFieldValues: Record<string, any>;
		}, userId: string) => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const jobId = await createJob(jobData, userId);

				// Reload jobs to get the new one with all fields
				await createJobsStore().load();

				return jobId;
			} catch (error: any) {
				console.error('Error creating job:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to create job'
				}));
				throw error;
			}
		},

		/**
		 * Update an existing job
		 */
		update: async (jobId: string, updates: Partial<Job>, userId: string) => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				await updateJob(jobId, updates, userId);

				// Update local state
				update((state) => ({
					...state,
					jobs: state.jobs.map((job) =>
						job.id === jobId ? { ...job, ...updates } : job
					),
					loading: false
				}));
			} catch (error: any) {
				console.error('Error updating job:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to update job'
				}));
				throw error;
			}
		},

		/**
		 * Delete a job
		 */
		delete: async (jobId: string) => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				await deleteJob(jobId);

				// Remove from local state
				update((state) => ({
					...state,
					jobs: state.jobs.filter((job) => job.id !== jobId),
					loading: false
				}));
			} catch (error: any) {
				console.error('Error deleting job:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to delete job'
				}));
				throw error;
			}
		},

		/**
		 * Set filter text
		 */
		setFilter: (filter: string) => {
			update((state) => ({ ...state, filter }));
		},

		/**
		 * Set sort column and direction
		 */
		setSort: (sortBy: string, sortDirection: 'asc' | 'desc') => {
			update((state) => ({ ...state, sortBy, sortDirection }));
		},

		/**
		 * Toggle sort direction for a column
		 */
		toggleSort: (column: string) => {
			update((state) => {
				if (state.sortBy === column) {
					return {
						...state,
						sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc'
					};
				} else {
					return {
						...state,
						sortBy: column,
						sortDirection: 'asc'
					};
				}
			});
		},

		/**
		 * Refresh jobs (reload from Firestore)
		 */
		refresh: async () => {
			await createJobsStore().load();
		},

		/**
		 * Clear error
		 */
		clearError: () => {
			update((state) => ({ ...state, error: null }));
		}
	};
};

export const jobsStore = createJobsStore();

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Filtered and sorted jobs
 */
export const filteredJobs: Readable<Job[]> = derived(jobsStore, ($store) => {
	let filtered = $store.jobs;

	// Apply filter
	if ($store.filter) {
		const filterLower = $store.filter.toLowerCase();
		filtered = filtered.filter((job) => {
			// Search in projectId
			if (job.projectId.toLowerCase().includes(filterLower)) return true;

			// Search in custom field values
			for (const value of Object.values(job.customFieldValues)) {
				if (String(value).toLowerCase().includes(filterLower)) return true;
			}

			// Search in status
			if (job.status.toLowerCase().includes(filterLower)) return true;

			return false;
		});
	}

	// Apply sorting
	filtered.sort((a, b) => {
		let aVal: any;
		let bVal: any;

		// Get values based on sort column
		if ($store.sortBy === 'projectId') {
			aVal = a.projectId;
			bVal = b.projectId;
		} else if ($store.sortBy === 'quantity') {
			aVal = a.quantity;
			bVal = b.quantity;
		} else if ($store.sortBy === 'status') {
			aVal = a.status;
			bVal = b.status;
		} else if ($store.sortBy === 'createdAt') {
			aVal = a.createdAt?.seconds || 0;
			bVal = b.createdAt?.seconds || 0;
		} else {
			// Custom field
			aVal = a.customFieldValues[$store.sortBy];
			bVal = b.customFieldValues[$store.sortBy];
		}

		// Handle null/undefined
		if (aVal === null || aVal === undefined) return 1;
		if (bVal === null || bVal === undefined) return -1;

		// Compare
		if (typeof aVal === 'string' && typeof bVal === 'string') {
			return $store.sortDirection === 'asc'
				? aVal.localeCompare(bVal)
				: bVal.localeCompare(aVal);
		} else {
			return $store.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
		}
	});

	return filtered;
});

/**
 * Is loading jobs
 */
export const jobsLoading: Readable<boolean> = derived(jobsStore, ($store) => $store.loading);

/**
 * Jobs error
 */
export const jobsError: Readable<string | null> = derived(jobsStore, ($store) => $store.error);

/**
 * Current filter text
 */
export const jobsFilter: Readable<string> = derived(jobsStore, ($store) => $store.filter);

/**
 * Current sort column
 */
export const jobsSortBy: Readable<string> = derived(jobsStore, ($store) => $store.sortBy);

/**
 * Current sort direction
 */
export const jobsSortDirection: Readable<'asc' | 'desc'> = derived(
	jobsStore,
	($store) => $store.sortDirection
);
