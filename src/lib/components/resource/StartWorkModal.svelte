<script lang="ts">
	import { currentUser } from '$lib/stores/auth';
	import { updateWorkOrder, createTimeEntry } from '$lib/utils/firestore';
	import type { WorkOrder } from '$lib/types';
	import { WorkOrderStatus } from '$lib/types';

	let {
		isOpen = $bindable(),
		workOrder,
		onSuccess
	}: {
		isOpen: boolean;
		workOrder: WorkOrder | null;
		onSuccess?: () => void;
	} = $props();

	// UI state
	let submitting = $state(false);
	let error = $state<string | null>(null);

	// Close modal
	function close() {
		isOpen = false;
		error = null;
	}

	// Handle start work
	async function handleStart() {
		if (!workOrder || !$currentUser) return;

		error = null;
		submitting = true;

		try {
			// Update work order status to ACTIVE
			await updateWorkOrder(
				workOrder.jobId,
				workOrder.id,
				{
					status: WorkOrderStatus.ACTIVE,
					startedBy: $currentUser.uid,
					startedAt: new Date() as any // Will be converted to Timestamp by Firestore
				},
				$currentUser.uid
			);

			// Create time entry
			await createTimeEntry(workOrder.jobId, workOrder.id, $currentUser.uid);

			if (onSuccess) onSuccess();
			close();
		} catch (err: any) {
			console.error('Error starting work:', err);
			error = err.message || 'Failed to start work';
		} finally {
			submitting = false;
		}
	}
</script>

{#if isOpen && workOrder}
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
				<h2 id="modal-title" class="text-xl font-bold text-gray-900">Start Work Order</h2>
			</div>

			<!-- Modal Body -->
			<div class="p-6 space-y-4">
				<!-- Error Message -->
				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
						{error}
					</div>
				{/if}

				<p class="text-gray-600">
					You are about to start work on this order. A time entry will be created to track your
					work.
				</p>

				<!-- Work Order Details -->
				<div class="bg-gray-50 rounded-lg p-4 space-y-3">
					<div>
						<div class="text-sm text-gray-500">Job ID</div>
						<div class="font-semibold text-gray-900">{workOrder.jobId}</div>
					</div>

					<div class="grid grid-cols-2 gap-4 text-sm">
						<div>
							<div class="text-gray-500">Quantity</div>
							<div class="font-medium text-gray-900">{workOrder.quantityTarget} units</div>
						</div>
						<div>
							<div class="text-gray-500">Est. Duration</div>
							<div class="font-medium text-gray-900">{workOrder.estimatedDuration} min</div>
						</div>
					</div>
				</div>

				<div class="bg-green-50 border border-green-200 rounded-lg p-3">
					<p class="text-sm text-green-800">
						✓ Timer will start automatically when you click "Start Work"
					</p>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
				<button
					onclick={close}
					class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					onclick={handleStart}
					class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={submitting}
				>
					{submitting ? 'Starting...' : '▶ Start Work'}
				</button>
			</div>
		</div>
	</div>
{/if}
