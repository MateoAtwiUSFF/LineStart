<script lang="ts">
	import { resourcesStore } from '$lib/stores/resources';
	import type { Resource } from '$lib/types';

	let {
		isOpen = $bindable(),
		resource,
		onSuccess
	}: {
		isOpen: boolean;
		resource: Resource | null;
		onSuccess?: () => void;
	} = $props();

	// Form state - initialize from resource prop
	let uid = $state('');
	let name = $state('');
	let startTime = $state('08:00');
	let endTime = $state('17:00');
	let selectedDays = $state<number[]>([1, 2, 3, 4, 5]);
	let overtimeHours = $state(0);
	let defaultProductionRate = $state(30);
	let setupTime = $state(15);

	// UI state
	let submitting = $state(false);
	let error = $state<string | null>(null);

	// Days of week options
	const daysOfWeek = [
		{ value: 0, label: 'Sunday', short: 'Sun' },
		{ value: 1, label: 'Monday', short: 'Mon' },
		{ value: 2, label: 'Tuesday', short: 'Tue' },
		{ value: 3, label: 'Wednesday', short: 'Wed' },
		{ value: 4, label: 'Thursday', short: 'Thu' },
		{ value: 5, label: 'Friday', short: 'Fri' },
		{ value: 6, label: 'Saturday', short: 'Sat' }
	];

	// Load resource data when modal opens
	$effect(() => {
		if (isOpen && resource) {
			uid = resource.uid;
			name = resource.name;
			startTime = resource.operationalHours.startTime;
			endTime = resource.operationalHours.endTime;
			selectedDays = [...resource.operationalHours.daysOfWeek];
			overtimeHours = resource.overtimeHours;
			defaultProductionRate = resource.defaultProductionRate;
			setupTime = resource.setupTime;
			error = null;
		}
	});

	// Toggle day selection
	function toggleDay(day: number) {
		if (selectedDays.includes(day)) {
			selectedDays = selectedDays.filter((d) => d !== day);
		} else {
			selectedDays = [...selectedDays, day].sort();
		}
	}

	// Close modal
	function close() {
		isOpen = false;
	}

	// Handle form submission
	async function handleSubmit() {
		if (!resource) return;

		error = null;

		// Validation
		if (!uid.trim()) {
			error = 'Resource ID is required';
			return;
		}
		if (!name.trim()) {
			error = 'Resource name is required';
			return;
		}
		if (selectedDays.length === 0) {
			error = 'At least one operating day must be selected';
			return;
		}
		if (defaultProductionRate <= 0) {
			error = 'Production rate must be greater than 0';
			return;
		}
		if (setupTime < 0) {
			error = 'Setup time cannot be negative';
			return;
		}
		if (overtimeHours < 0) {
			error = 'Overtime hours cannot be negative';
			return;
		}

		submitting = true;

		try {
			const updates: Partial<Resource> = {
				uid: uid.trim(),
				name: name.trim(),
				operationalHours: {
					startTime,
					endTime,
					daysOfWeek: selectedDays
				},
				overtimeHours,
				defaultProductionRate,
				setupTime
			};

			await resourcesStore.update(resource.id, updates);

			if (onSuccess) onSuccess();
			close();
		} catch (err: any) {
			error = err.message || 'Failed to update resource';
		} finally {
			submitting = false;
		}
	}
</script>

{#if isOpen && resource}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4"
		onclick={close}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Modal Content -->
		<div
			class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Modal Header -->
			<div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
				<h2 id="modal-title" class="text-xl font-bold text-gray-900">Edit Resource</h2>
				<button
					onclick={close}
					class="text-gray-400 hover:text-gray-600 transition"
					aria-label="Close modal"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Modal Body -->
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="p-6 space-y-6">
				<!-- Error Message -->
				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
						{error}
					</div>
				{/if}

				<!-- Basic Information -->
				<div class="space-y-4">
					<h3 class="font-semibold text-gray-900">Basic Information</h3>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Resource ID -->
						<div>
							<label for="uid" class="block text-sm font-medium text-gray-700 mb-1">
								Resource ID <span class="text-red-500">*</span>
							</label>
							<input
								id="uid"
								type="text"
								bind:value={uid}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								placeholder="e.g., M1, CNC-A"
								required
							/>
							<p class="text-xs text-gray-500 mt-1">Unique identifier for this resource</p>
						</div>

						<!-- Resource Name -->
						<div>
							<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
								Resource Name <span class="text-red-500">*</span>
							</label>
							<input
								id="name"
								type="text"
								bind:value={name}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								placeholder="e.g., CNC Machine A"
								required
							/>
						</div>
					</div>
				</div>

				<!-- Production Settings -->
				<div class="space-y-4">
					<h3 class="font-semibold text-gray-900">Production Settings</h3>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Production Rate -->
						<div>
							<label for="production-rate" class="block text-sm font-medium text-gray-700 mb-1">
								Production Rate (units/hour) <span class="text-red-500">*</span>
							</label>
							<input
								id="production-rate"
								type="number"
								bind:value={defaultProductionRate}
								min="0.1"
								step="0.1"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								required
							/>
						</div>

						<!-- Setup Time -->
						<div>
							<label for="setup-time" class="block text-sm font-medium text-gray-700 mb-1">
								Setup Time (minutes) <span class="text-red-500">*</span>
							</label>
							<input
								id="setup-time"
								type="number"
								bind:value={setupTime}
								min="0"
								step="1"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								required
							/>
						</div>

						<!-- Overtime Hours -->
						<div>
							<label for="overtime" class="block text-sm font-medium text-gray-700 mb-1">
								Overtime Hours (per day)
							</label>
							<input
								id="overtime"
								type="number"
								bind:value={overtimeHours}
								min="0"
								step="0.5"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
							/>
						</div>
					</div>
				</div>

				<!-- Operational Hours -->
				<div class="space-y-4">
					<h3 class="font-semibold text-gray-900">Operational Hours</h3>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Start Time -->
						<div>
							<label for="start-time" class="block text-sm font-medium text-gray-700 mb-1">
								Start Time <span class="text-red-500">*</span>
							</label>
							<input
								id="start-time"
								type="time"
								bind:value={startTime}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								required
							/>
						</div>

						<!-- End Time -->
						<div>
							<label for="end-time" class="block text-sm font-medium text-gray-700 mb-1">
								End Time <span class="text-red-500">*</span>
							</label>
							<input
								id="end-time"
								type="time"
								bind:value={endTime}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								required
							/>
						</div>
					</div>

					<!-- Days of Week -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Operating Days <span class="text-red-500">*</span>
						</label>
						<div class="flex flex-wrap gap-2">
							{#each daysOfWeek as day}
								<button
									type="button"
									onclick={() => toggleDay(day.value)}
									class="px-4 py-2 rounded-lg border-2 transition font-medium {selectedDays.includes(
										day.value
									)
										? 'bg-indigo-600 text-white border-indigo-600'
										: 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}"
								>
									{day.short}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Modal Footer -->
				<div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
					<button
						type="button"
						onclick={close}
						class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
						disabled={submitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={submitting}
					>
						{submitting ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
