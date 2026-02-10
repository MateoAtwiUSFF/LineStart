<script lang="ts">
	import { resourcesStore } from '$lib/stores/resources';
	import { Timestamp } from 'firebase/firestore';
	import type { Resource, ScheduledDowntime } from '$lib/types';

	let {
		isOpen = $bindable(),
		resource,
		onSuccess
	}: {
		isOpen: boolean;
		resource: Resource | null;
		onSuccess?: () => void;
	} = $props();

	// Form state
	let startDate = $state('');
	let startTime = $state('08:00');
	let endDate = $state('');
	let endTime = $state('17:00');
	let reason = $state('');

	// Existing downtime list
	let existingDowntime = $state<ScheduledDowntime[]>([]);
	let loadingDowntime = $state(false);

	// UI state
	let submitting = $state(false);
	let error = $state<string | null>(null);

	// Load existing downtime when modal opens
	$effect(() => {
		if (isOpen && resource) {
			loadExistingDowntime();
			resetForm();
		}
	});

	async function loadExistingDowntime() {
		if (!resource) return;

		loadingDowntime = true;
		try {
			existingDowntime = await resourcesStore.getScheduledDowntime(resource.id);
		} catch (err: any) {
			console.error('Error loading downtime:', err);
		} finally {
			loadingDowntime = false;
		}
	}

	// Reset form
	function resetForm() {
		const now = new Date();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);

		startDate = now.toISOString().split('T')[0];
		startTime = '08:00';
		endDate = tomorrow.toISOString().split('T')[0];
		endTime = '17:00';
		reason = '';
		error = null;
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
		if (!startDate || !startTime) {
			error = 'Start date and time are required';
			return;
		}
		if (!endDate || !endTime) {
			error = 'End date and time are required';
			return;
		}
		if (!reason.trim()) {
			error = 'Reason is required';
			return;
		}

		// Parse dates
		const start = new Date(`${startDate}T${startTime}`);
		const end = new Date(`${endDate}T${endTime}`);

		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			error = 'Invalid date or time format';
			return;
		}

		if (end <= start) {
			error = 'End time must be after start time';
			return;
		}

		submitting = true;

		try {
			const downtime: Omit<ScheduledDowntime, 'id'> = {
				startTime: Timestamp.fromDate(start),
				endTime: Timestamp.fromDate(end),
				reason: reason.trim()
			};

			await resourcesStore.addScheduledDowntime(resource.id, downtime);

			// Reload downtime list
			await loadExistingDowntime();

			// Reset form for next entry
			resetForm();

			if (onSuccess) onSuccess();
		} catch (err: any) {
			error = err.message || 'Failed to schedule downtime';
		} finally {
			submitting = false;
		}
	}

	// Delete downtime
	async function handleDelete(downtimeId: string) {
		if (!resource) return;
		if (!confirm('Are you sure you want to delete this scheduled downtime?')) return;

		try {
			await resourcesStore.deleteScheduledDowntime(resource.id, downtimeId);
			await loadExistingDowntime();
			if (onSuccess) onSuccess();
		} catch (err: any) {
			error = err.message || 'Failed to delete downtime';
		}
	}

	// Format timestamp for display
	function formatTimestamp(timestamp: any): string {
		if (!timestamp || !timestamp.toDate) return 'N/A';
		const date = timestamp.toDate();
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
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
			class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Modal Header -->
			<div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
				<div>
					<h2 id="modal-title" class="text-xl font-bold text-gray-900">Schedule Downtime</h2>
					<p class="text-sm text-gray-600 mt-1">{resource.name} ({resource.uid})</p>
				</div>
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
			<div class="p-6 space-y-6">
				<!-- Error Message -->
				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
						{error}
					</div>
				{/if}

				<!-- Add Downtime Form -->
				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<h3 class="font-semibold text-gray-900">Add New Downtime</h3>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Start Date/Time -->
						<div>
							<label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">
								Start Date <span class="text-red-500">*</span>
							</label>
							<input
								id="start-date"
								type="date"
								bind:value={startDate}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								required
							/>
						</div>

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

						<!-- End Date/Time -->
						<div>
							<label for="end-date" class="block text-sm font-medium text-gray-700 mb-1">
								End Date <span class="text-red-500">*</span>
							</label>
							<input
								id="end-date"
								type="date"
								bind:value={endDate}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								required
							/>
						</div>

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

					<!-- Reason -->
					<div>
						<label for="reason" class="block text-sm font-medium text-gray-700 mb-1">
							Reason <span class="text-red-500">*</span>
						</label>
						<textarea
							id="reason"
							bind:value={reason}
							rows="2"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
							placeholder="e.g., Scheduled maintenance, Equipment upgrade"
							required
						></textarea>
					</div>

					<!-- Submit Button -->
					<div class="flex justify-end">
						<button
							type="submit"
							class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={submitting}
						>
							{submitting ? 'Adding...' : 'Add Downtime'}
						</button>
					</div>
				</form>

				<!-- Existing Downtime List -->
				<div class="border-t border-gray-200 pt-6">
					<h3 class="font-semibold text-gray-900 mb-4">Scheduled Downtime</h3>

					{#if loadingDowntime}
						<div class="text-center py-8">
							<div
								class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"
							></div>
						</div>
					{:else if existingDowntime.length === 0}
						<p class="text-gray-500 text-center py-8">No scheduled downtime</p>
					{:else}
						<div class="space-y-3">
							{#each existingDowntime as downtime}
								<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<div class="flex items-center gap-2 mb-2">
												<svg
													class="w-5 h-5 text-amber-600"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
												<span class="font-semibold text-gray-900">{downtime.reason}</span>
											</div>
											<div class="text-sm text-gray-600 space-y-1">
												<div>
													<span class="font-medium">Start:</span>
													{formatTimestamp(downtime.startTime)}
												</div>
												<div>
													<span class="font-medium">End:</span>
													{formatTimestamp(downtime.endTime)}
												</div>
											</div>
										</div>
										<button
											onclick={() => handleDelete(downtime.id)}
											class="ml-4 text-red-600 hover:text-red-800 transition"
											aria-label="Delete downtime"
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Modal Footer -->
				<div class="flex items-center justify-end pt-4 border-t border-gray-200">
					<button
						type="button"
						onclick={close}
						class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
