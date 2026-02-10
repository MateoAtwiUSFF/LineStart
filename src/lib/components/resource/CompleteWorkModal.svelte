<script lang="ts">
	import { currentUser } from '$lib/stores/auth';
	import {
		getTimeEntries,
		closeTimeEntry,
		updateWorkOrder,
		createWorkOrder
	} from '$lib/utils/firestore';
	import type { WorkOrder, TimeEntry } from '$lib/types';
	import { WorkOrderStatus, WorkOrderType, Priority } from '$lib/types';
	import { Timestamp } from 'firebase/firestore';

	let {
		isOpen = $bindable(),
		workOrder,
		onSuccess
	}: {
		isOpen: boolean;
		workOrder: WorkOrder | null;
		onSuccess?: () => void;
	} = $props();

	// Form state
	let quantityCompleted = $state(0);
	let timeEntries = $state<TimeEntry[]>([]);
	let loadingTimeEntries = $state(false);

	// UI state
	let submitting = $state(false);
	let error = $state<string | null>(null);

	// Load time entries when modal opens
	$effect(() => {
		if (isOpen && workOrder) {
			quantityCompleted = workOrder.quantityTarget - workOrder.quantityCompleted;
			loadTimeEntries();
		}
	});

	// Load time entries for this work order
	async function loadTimeEntries() {
		if (!workOrder) return;

		loadingTimeEntries = true;
		try {
			timeEntries = await getTimeEntries(workOrder.jobId, workOrder.id);
		} catch (err: any) {
			console.error('Error loading time entries:', err);
		} finally {
			loadingTimeEntries = false;
		}
	}

	// Find active (unclosed) time entry
	function getActiveTimeEntry(): TimeEntry | null {
		return timeEntries.find((te) => te.endTime === null) || null;
	}

	// Close modal
	function close() {
		isOpen = false;
		error = null;
		quantityCompleted = 0;
	}

	// Handle complete work
	async function handleComplete() {
		if (!workOrder || !$currentUser) return;

		error = null;

		// Validation
		if (quantityCompleted <= 0) {
			error = 'Quantity completed must be greater than 0';
			return;
		}

		if (quantityCompleted > workOrder.quantityTarget - workOrder.quantityCompleted) {
			error = `Quantity cannot exceed remaining target (${workOrder.quantityTarget - workOrder.quantityCompleted} units)`;
			return;
		}

		submitting = true;

		try {
			// Find and close active time entry
			const activeTimeEntry = getActiveTimeEntry();
			if (activeTimeEntry) {
				await closeTimeEntry(workOrder.jobId, workOrder.id, activeTimeEntry.id, quantityCompleted);
			}

			// Calculate new total quantity completed
			const newQuantityCompleted = workOrder.quantityCompleted + quantityCompleted;
			const isFullyCompleted = newQuantityCompleted >= workOrder.quantityTarget;

			if (isFullyCompleted) {
				// Mark work order as COMPLETED
				await updateWorkOrder(
					workOrder.jobId,
					workOrder.id,
					{
						status: WorkOrderStatus.COMPLETED,
						quantityCompleted: workOrder.quantityTarget,
						completedBy: $currentUser.uid,
						completedAt: Timestamp.now()
					},
					$currentUser.uid
				);
			} else {
				// Mark as PARTIAL
				await updateWorkOrder(
					workOrder.jobId,
					workOrder.id,
					{
						status: WorkOrderStatus.PARTIAL,
						quantityCompleted: newQuantityCompleted,
						completedBy: $currentUser.uid,
						completedAt: Timestamp.now()
					},
					$currentUser.uid
				);

				// Create new work order for remaining quantity
				const remainingQuantity = workOrder.quantityTarget - newQuantityCompleted;
				await createWorkOrder(
					{
						jobId: workOrder.jobId,
						resourceId: '', // Unassigned - goes back to PM
						type: WorkOrderType.PRODUCTION,
						priority: workOrder.priority,
						estimatedDuration: 0, // Will be calculated when assigned
						scheduledStart: null,
						status: WorkOrderStatus.QUEUED,
						quantityTarget: remainingQuantity,
						quantityCompleted: 0
					},
					$currentUser.uid
				);
			}

			if (onSuccess) onSuccess();
			close();
		} catch (err: any) {
			console.error('Error completing work:', err);
			error = err.message || 'Failed to complete work';
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
				<h2 id="modal-title" class="text-xl font-bold text-gray-900">Complete Work Order</h2>
			</div>

			<!-- Modal Body -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleComplete();
				}}
				class="p-6 space-y-4"
			>
				<!-- Error Message -->
				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
						{error}
					</div>
				{/if}

				<!-- Work Order Summary -->
				<div class="bg-gray-50 rounded-lg p-4 space-y-3">
					<div>
						<div class="text-sm text-gray-500">Job ID</div>
						<div class="font-semibold text-gray-900">{workOrder.jobId}</div>
					</div>

					<div class="grid grid-cols-2 gap-4 text-sm">
						<div>
							<div class="text-gray-500">Target Quantity</div>
							<div class="font-medium text-gray-900">{workOrder.quantityTarget} units</div>
						</div>
						<div>
							<div class="text-gray-500">Already Completed</div>
							<div class="font-medium text-gray-900">{workOrder.quantityCompleted} units</div>
						</div>
					</div>

					<div>
						<div class="text-sm text-gray-500">Remaining</div>
						<div class="font-semibold text-indigo-600">
							{workOrder.quantityTarget - workOrder.quantityCompleted} units
						</div>
					</div>
				</div>

				<!-- Quantity Completed Input -->
				<div>
					<label for="quantity-completed" class="block text-sm font-medium text-gray-700 mb-1">
						Quantity Completed <span class="text-red-500">*</span>
					</label>
					<input
						id="quantity-completed"
						type="number"
						bind:value={quantityCompleted}
						min="1"
						max={workOrder.quantityTarget - workOrder.quantityCompleted}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						required
					/>
					<p class="text-xs text-gray-500 mt-1">
						Enter the number of units you completed in this session
					</p>
				</div>

				<!-- Partial Completion Warning -->
				{#if quantityCompleted > 0 && quantityCompleted < workOrder.quantityTarget - workOrder.quantityCompleted}
					<div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
						<p class="text-sm text-amber-800">
							<strong>Partial Completion:</strong> The remaining
							{workOrder.quantityTarget - workOrder.quantityCompleted - quantityCompleted}
							units will be created as a new work order and returned to the queue.
						</p>
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
						class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={submitting}
					>
						{submitting ? 'Completing...' : '✓ Complete Work'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
