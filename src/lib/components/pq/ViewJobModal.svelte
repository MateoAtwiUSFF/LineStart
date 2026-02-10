<script lang="ts">
	import type { Job } from '$lib/types';
	import { formatTimestamp } from '$lib/utils/calculations';

	let {
		isOpen = $bindable(),
		job,
		onClose
	}: {
		isOpen: boolean;
		job: Job | null;
		onClose?: () => void;
	} = $props();

	// Close modal
	function close() {
		isOpen = false;
		if (onClose) onClose();
	}

	// Get status badge class
	function getStatusBadge(status: string) {
		switch (status) {
			case 'unassigned':
				return { text: 'Unassigned', class: 'bg-gray-100 text-gray-800 border-gray-300' };
			case 'assigned':
				return { text: 'Assigned', class: 'bg-blue-100 text-blue-800 border-blue-300' };
			case 'in_progress':
				return { text: 'In Progress', class: 'bg-green-100 text-green-800 border-green-300' };
			case 'finished':
				return { text: 'Finished', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
			default:
				return { text: status, class: 'bg-gray-100 text-gray-800 border-gray-300' };
		}
	}
</script>

{#if isOpen && job}
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
			<div class="px-6 py-4 border-b border-gray-200">
				<h2 id="modal-title" class="text-xl font-bold text-gray-900">Job Details</h2>
			</div>

			<!-- Modal Body -->
			<div class="p-6 space-y-6">
				<!-- Project ID -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
					<div class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
						{job.projectId}
					</div>
				</div>

				<!-- Quantity -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
					<div class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
						{job.quantity} units
					</div>
				</div>

				<!-- Status -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
					<div>
						<span
							class="inline-block px-3 py-1 text-sm font-semibold rounded-full border {getStatusBadge(job.status).class}"
						>
							{getStatusBadge(job.status).text}
						</span>
					</div>
				</div>

				<!-- Custom Fields -->
				{#if job.customFieldValues && Object.keys(job.customFieldValues).length > 0}
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">Custom Fields</label>
						<div class="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-2">
							{#each Object.entries(job.customFieldValues) as [fieldName, fieldValue]}
								<div class="flex justify-between">
									<span class="text-sm font-medium text-gray-700">{fieldName}:</span>
									<span class="text-sm text-gray-900">{fieldValue}</span>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Custom Fields</label>
						<div class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 italic">
							No custom fields
						</div>
					</div>
				{/if}

				<!-- Created Info -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Created At</label>
						<div class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm">
							{formatTimestamp(job.createdAt, true)}
						</div>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Created By</label>
						<div class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm">
							{job.createdBy}
						</div>
					</div>
				</div>

				<!-- Modified Info -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Modified At</label>
						<div class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm">
							{formatTimestamp(job.modifiedAt, true)}
						</div>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Modified By</label>
						<div class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm">
							{job.modifiedBy}
						</div>
					</div>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="px-6 py-4 border-t border-gray-200 flex justify-end">
				<button
					type="button"
					onclick={close}
					class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
