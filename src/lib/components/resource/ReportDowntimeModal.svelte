<script lang="ts">
	import { updateResource } from '$lib/utils/firestore';
	import { Timestamp } from 'firebase/firestore';
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

	// Form state
	let reason = $state('');
	let isClearing = $derived(resource?.currentDowntime?.isDown || false);

	// UI state
	let submitting = $state(false);
	let error = $state<string | null>(null);

	// Reset form when opening
	$effect(() => {
		if (isOpen) {
			reason = '';
			error = null;
		}
	});

	// Close modal
	function close() {
		isOpen = false;
		reason = '';
		error = null;
	}

	// Handle report downtime
	async function handleReport() {
		if (!resource) return;

		error = null;

		// Validation for reporting downtime
		if (!isClearing && !reason.trim()) {
			error = 'Please provide a reason for the downtime';
			return;
		}

		submitting = true;

		try {
			if (isClearing) {
				// Clear downtime
				await updateResource(resource.id, {
					currentDowntime: {
						isDown: false,
						startTime: null,
						reason: null
					}
				});
			} else {
				// Report downtime
				await updateResource(resource.id, {
					currentDowntime: {
						isDown: true,
						startTime: Timestamp.now(),
						reason: reason.trim()
					}
				});
			}

			if (onSuccess) onSuccess();
			close();
		} catch (err: any) {
			console.error('Error updating downtime:', err);
			error = err.message || 'Failed to update downtime';
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
			class="bg-white rounded-lg shadow-xl max-w-md w-full"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Modal Header -->
			<div class="px-6 py-4 border-b border-gray-200">
				<h2 id="modal-title" class="text-xl font-bold text-gray-900">
					{isClearing ? 'Clear Downtime' : 'Report Downtime'}
				</h2>
			</div>

			<!-- Modal Body -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleReport();
				}}
				class="p-6 space-y-4"
			>
				<!-- Error Message -->
				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
						{error}
					</div>
				{/if}

				<!-- Resource Info -->
				<div class="bg-gray-50 rounded-lg p-4">
					<div class="text-sm text-gray-500">Resource</div>
					<div class="font-semibold text-gray-900">{resource.name}</div>
					<div class="text-sm text-gray-500 mt-1">ID: {resource.uid}</div>
				</div>

				{#if isClearing}
					<!-- Clearing Downtime -->
					<div class="space-y-3">
						<p class="text-gray-700">
							The resource is currently marked as down. Click "Clear Downtime" to mark it as
							operational again.
						</p>

						{#if resource.currentDowntime?.reason}
							<div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
								<p class="text-sm text-amber-800">
									<strong>Current reason:</strong>
									{resource.currentDowntime.reason}
								</p>
							</div>
						{/if}

						<div class="bg-green-50 border border-green-200 rounded-lg p-3">
							<p class="text-sm text-green-800">
								✓ Clearing downtime will allow work to resume on this resource
							</p>
						</div>
					</div>
				{:else}
					<!-- Reporting Downtime -->
					<div class="space-y-3">
						<p class="text-gray-700">
							Report unscheduled downtime when the resource is experiencing issues that prevent work
							from continuing.
						</p>

						<div>
							<label for="reason" class="block text-sm font-medium text-gray-700 mb-1">
								Reason for Downtime <span class="text-red-500">*</span>
							</label>
							<textarea
								id="reason"
								bind:value={reason}
								rows="3"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
								placeholder="e.g., Machine malfunction, Tool breakage, Material shortage"
								required
							></textarea>
						</div>

						<div class="bg-red-50 border border-red-200 rounded-lg p-3">
							<p class="text-sm text-red-800">
								<strong>⚠ Warning:</strong> This will mark the resource as down and push scheduled
								work orders until the issue is resolved.
							</p>
						</div>
					</div>
				{/if}

				<!-- Modal Footer -->
				<div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
					<button
						type="button"
						onclick={close}
						class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
						disabled={submitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-6 py-2 {isClearing
							? 'bg-green-600 hover:bg-green-700'
							: 'bg-red-600 hover:bg-red-700'} text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={submitting}
					>
						{#if submitting}
							{isClearing ? 'Clearing...' : 'Reporting...'}
						{:else}
							{isClearing ? '✓ Clear Downtime' : '⚠ Report Downtime'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
