/**
 * Resources store
 * Manages resource data for assignment dropdowns and configuration
 */

import { writable, derived, type Readable } from 'svelte/store';
import {
	getAllResources,
	createResource,
	updateResource,
	deleteResource,
	getScheduledDowntime,
	addScheduledDowntime,
	deleteScheduledDowntime
} from '$lib/utils/firestore';
import type { Resource, CreateResourceInput, ScheduledDowntime } from '$lib/types';

// ============================================================================
// STORE
// ============================================================================

interface ResourcesState {
	resources: Resource[];
	loading: boolean;
	error: string | null;
}

const createResourcesStore = () => {
	const { subscribe, set, update } = writable<ResourcesState>({
		resources: [],
		loading: false,
		error: null
	});

	return {
		subscribe,

		/**
		 * Load all resources from Firestore
		 */
		load: async () => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const resources = await getAllResources();
				update((state) => ({ ...state, resources, loading: false }));
			} catch (error: any) {
				console.error('Error loading resources:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to load resources'
				}));
			}
		},

		/**
		 * Create a new resource
		 */
		create: async (resourceData: CreateResourceInput) => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const resourceId = await createResource(resourceData);

				// Reload resources to get the new one
				await createResourcesStore().load();

				return resourceId;
			} catch (error: any) {
				console.error('Error creating resource:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to create resource'
				}));
				throw error;
			}
		},

		/**
		 * Update an existing resource
		 */
		update: async (resourceId: string, updates: Partial<Resource>) => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				await updateResource(resourceId, updates);

				// Update local state
				update((state) => ({
					...state,
					resources: state.resources.map((resource) =>
						resource.id === resourceId ? { ...resource, ...updates } : resource
					),
					loading: false
				}));
			} catch (error: any) {
				console.error('Error updating resource:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to update resource'
				}));
				throw error;
			}
		},

		/**
		 * Delete a resource
		 */
		delete: async (resourceId: string) => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				await deleteResource(resourceId);

				// Remove from local state
				update((state) => ({
					...state,
					resources: state.resources.filter((resource) => resource.id !== resourceId),
					loading: false
				}));
			} catch (error: any) {
				console.error('Error deleting resource:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to delete resource'
				}));
				throw error;
			}
		},

		/**
		 * Get scheduled downtime for a resource
		 */
		getScheduledDowntime: async (resourceId: string): Promise<ScheduledDowntime[]> => {
			try {
				return await getScheduledDowntime(resourceId);
			} catch (error: any) {
				console.error('Error fetching scheduled downtime:', error);
				throw error;
			}
		},

		/**
		 * Add scheduled downtime
		 */
		addScheduledDowntime: async (
			resourceId: string,
			downtime: Omit<ScheduledDowntime, 'id'>
		): Promise<string> => {
			try {
				const downtimeId = await addScheduledDowntime(resourceId, downtime);
				return downtimeId;
			} catch (error: any) {
				console.error('Error adding scheduled downtime:', error);
				throw error;
			}
		},

		/**
		 * Delete scheduled downtime
		 */
		deleteScheduledDowntime: async (resourceId: string, downtimeId: string): Promise<void> => {
			try {
				await deleteScheduledDowntime(resourceId, downtimeId);
			} catch (error: any) {
				console.error('Error deleting scheduled downtime:', error);
				throw error;
			}
		},

		/**
		 * Refresh resources (reload from Firestore)
		 */
		refresh: async () => {
			await createResourcesStore().load();
		},

		/**
		 * Clear error
		 */
		clearError: () => {
			update((state) => ({ ...state, error: null }));
		}
	};
};

export const resourcesStore = createResourcesStore();

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * All resources
 */
export const resources: Readable<Resource[]> = derived(
	resourcesStore,
	($store) => $store.resources
);

/**
 * Is loading resources
 */
export const resourcesLoading: Readable<boolean> = derived(
	resourcesStore,
	($store) => $store.loading
);

/**
 * Resources error
 */
export const resourcesError: Readable<string | null> = derived(
	resourcesStore,
	($store) => $store.error
);
