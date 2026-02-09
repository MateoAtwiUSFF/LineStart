/**
 * Configuration store for Production Queue
 * Manages custom fields and custom states
 */

import { writable, derived, type Readable } from 'svelte/store';
import {
	getProductionQueueConfig,
	updateProductionQueueConfig
} from '$lib/utils/firestore';
import type { ProductionQueueConfig, CustomField, CustomState } from '$lib/types';
import { CustomFieldType } from '$lib/types';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ProductionQueueConfig = {
	customFields: [
		{ name: 'Customer', type: CustomFieldType.STRING, required: true },
		{ name: 'DueDate', type: CustomFieldType.DATE, required: false },
		{ name: 'Priority', type: CustomFieldType.STRING, required: false, defaultValue: 'Normal' }
	],
	customStates: [
		{ name: 'Rush Order', color: '#EF4444' },
		{ name: 'On Hold', color: '#F59E0B' },
		{ name: 'Approved', color: '#10B981' }
	],
	defaultStates: [
		{ name: 'Unassigned', color: '#6B7280' },
		{ name: 'Assigned', color: '#3B82F6' },
		{ name: 'In Progress', color: '#8B5CF6' },
		{ name: 'Finished', color: '#059669' }
	]
};

// ============================================================================
// STORE
// ============================================================================

interface ConfigState {
	config: ProductionQueueConfig;
	loading: boolean;
	error: string | null;
}

const createConfigStore = () => {
	const { subscribe, set, update } = writable<ConfigState>({
		config: DEFAULT_CONFIG,
		loading: false,
		error: null
	});

	return {
		subscribe,

		/**
		 * Load configuration from Firestore
		 */
		load: async () => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const config = await getProductionQueueConfig();

				if (config) {
					set({ config, loading: false, error: null });
				} else {
					// No config exists, use defaults
					set({ config: DEFAULT_CONFIG, loading: false, error: null });
				}
			} catch (error: any) {
				console.error('Error loading config:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to load configuration'
				}));
			}
		},

		/**
		 * Save configuration to Firestore
		 */
		save: async (config: ProductionQueueConfig) => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				await updateProductionQueueConfig(config);
				set({ config, loading: false, error: null });
			} catch (error: any) {
				console.error('Error saving config:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.message || 'Failed to save configuration'
				}));
				throw error;
			}
		},

		/**
		 * Add a custom field
		 */
		addCustomField: async (field: CustomField) => {
			const currentState = await new Promise<ConfigState>((resolve) => {
				const unsubscribe = subscribe((state) => {
					unsubscribe();
					resolve(state);
				});
			});

			const newConfig = {
				...currentState.config,
				customFields: [...currentState.config.customFields, field]
			};

			await createConfigStore().save(newConfig);
		},

		/**
		 * Remove a custom field
		 */
		removeCustomField: async (fieldName: string) => {
			const currentState = await new Promise<ConfigState>((resolve) => {
				const unsubscribe = subscribe((state) => {
					unsubscribe();
					resolve(state);
				});
			});

			const newConfig = {
				...currentState.config,
				customFields: currentState.config.customFields.filter((f) => f.name !== fieldName)
			};

			await createConfigStore().save(newConfig);
		},

		/**
		 * Add a custom state
		 */
		addCustomState: async (state: CustomState) => {
			const currentState = await new Promise<ConfigState>((resolve) => {
				const unsubscribe = subscribe((s) => {
					unsubscribe();
					resolve(s);
				});
			});

			const newConfig = {
				...currentState.config,
				customStates: [...currentState.config.customStates, state]
			};

			await createConfigStore().save(newConfig);
		},

		/**
		 * Remove a custom state
		 */
		removeCustomState: async (stateName: string) => {
			const currentState = await new Promise<ConfigState>((resolve) => {
				const unsubscribe = subscribe((s) => {
					unsubscribe();
					resolve(s);
				});
			});

			const newConfig = {
				...currentState.config,
				customStates: currentState.config.customStates.filter((s) => s.name !== stateName)
			};

			await createConfigStore().save(newConfig);
		},

		/**
		 * Clear error
		 */
		clearError: () => {
			update((state) => ({ ...state, error: null }));
		}
	};
};

export const configStore = createConfigStore();

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Current configuration
 */
export const config: Readable<ProductionQueueConfig> = derived(
	configStore,
	($store) => $store.config
);

/**
 * Custom fields list
 */
export const customFields: Readable<CustomField[]> = derived(
	config,
	($config) => $config.customFields
);

/**
 * Custom states list
 */
export const customStates: Readable<CustomState[]> = derived(
	config,
	($config) => $config.customStates
);

/**
 * All states (default + custom)
 */
export const allStates: Readable<CustomState[]> = derived(config, ($config) => [
	...$config.defaultStates,
	...$config.customStates
]);

/**
 * Is loading configuration
 */
export const configLoading: Readable<boolean> = derived(
	configStore,
	($store) => $store.loading
);

/**
 * Configuration error
 */
export const configError: Readable<string | null> = derived(
	configStore,
	($store) => $store.error
);
