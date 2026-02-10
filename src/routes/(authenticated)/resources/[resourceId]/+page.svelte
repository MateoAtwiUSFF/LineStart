<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/stores/auth';
	import {
		getResource,
		getWorkOrdersForResource,
		getTimeEntries,
		createTimeEntry,
		closeTimeEntry,
		updateWorkOrder
	} from '$lib/utils/firestore';
	import type { Resource, WorkOrder, TimeEntry } from '$lib/types';
	import { WorkOrderStatus } from '$lib/types';
	import StartWorkModal from '$lib/components/resource/StartWorkModal.svelte';
	import CompleteWorkModal from '$lib/components/resource/CompleteWorkModal.svelte';
	import ReportDowntimeModal from '$lib/components/resource/ReportDowntimeModal.svelte';

	// State
	let resource = $state<Resource | null>(null);
	let workOrders = $state<WorkOrder[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Modal state
	let showStartModal = $state(false);
	let showCompleteModal = $state(false);
	let showDowntimeModal = $state(false);
	let selectedWorkOrder = $state<WorkOrder | null>(null);

	// Derived states
	let activeWorkOrders = $derived(
		workOrders.filter(
			(wo) => wo.status === WorkOrderStatus.ACTIVE || wo.status === WorkOrderStatus.PAUSED
		)
	);
	let queuedWorkOrders = $derived(
		workOrders.filter((wo) => wo.status === WorkOrderStatus.QUEUED)
	);

	// Get resource ID from URL
	const resourceId = $derived($page.params.resourceId);

	// Load data on mount
	onMount(async () => {
		await loadData();
	});

	// Load resource and work orders
	async function loadData() {
		loading = true;
		error = null;

		try {
			// Load resource
			const loadedResource = await getResource(resourceId);
			if (!loadedResource) {
				error = 'Resource not found';
				return;
			}
			resource = loadedResource;

			// Load work orders
			workOrders = await getWorkOrdersForResource(resourceId);
		} catch (err: any) {
			console.error('Error loading resource data:', err);
			error = err.message || 'Failed to load resource data';
		} finally {
			loading = false;
		}
	}

	// Refresh data
	async function handleRefresh() {
		await loadData();
	}

	// Navigate back to resources list
	function goBack() {
		goto('/resources');
	}

	// Open start work modal
	function openStartModal(wo: WorkOrder) {
		selectedWorkOrder = wo;
		showStartModal = true;
	}

	// Open complete work modal
	function openCompleteModal(wo: WorkOrder) {
		selectedWorkOrder = wo;
		showCompleteModal = true;
	}

	// Handle pause work
	async function handlePause(wo: WorkOrder) {
		if (!$currentUser) return;

		try {
			// Get current time entries to find active one
			const timeEntries = await getTimeEntries(wo.jobId, wo.id);
			const activeTimeEntry = timeEntries.find((te) => te.endTime === null);

			if (activeTimeEntry) {
				// Close the active time entry with 0 quantity (quantity is only recorded on completion)
				await closeTimeEntry(wo.jobId, wo.id, activeTimeEntry.id, 0);
			}

			// Update work order status to PAUSED
			await updateWorkOrder(wo.jobId, wo.id, { status: WorkOrderStatus.PAUSED }, $currentUser.uid);

			// Reload data
			await loadData();
		} catch (err: any) {
			console.error('Error pausing work:', err);
			alert(err.message || 'Failed to pause work');
		}
	}

	// Handle resume work
	async function handleResume(wo: WorkOrder) {
		if (!$currentUser) return;

		try {
			// Create new time entry
			await createTimeEntry(wo.jobId, wo.id, $currentUser.uid);

			// Update work order status to ACTIVE
			await updateWorkOrder(wo.jobId, wo.id, { status: WorkOrderStatus.ACTIVE }, $currentUser.uid);

			// Reload data
			await loadData();
		} catch (err: any) {
			console.error('Error resuming work:', err);
			alert(err.message || 'Failed to resume work');
		}
	}

	// Handle modal success
	function handleModalSuccess() {
		loadData();
	}

	// Get status badge class
	function getStatusBadge(resource: Resource) {
		if (resource.currentDowntime?.isDown) {
			return {
				text: 'Down',
				class: 'bg-red-100 text-red-800 border-red-200'
			};
		}
		return {
			text: 'Operational',
			class: 'bg-green-100 text-green-800 border-green-200'
		};
	}

	// Get work order status badge
	function getWorkOrderStatusBadge(status: WorkOrderStatus) {
		switch (status) {
			case WorkOrderStatus.QUEUED:
				return { text: 'Queued', class: 'bg-gray-100 text-gray-800 border-gray-300' };
			case WorkOrderStatus.ACTIVE:
				return { text: 'Active', class: 'bg-green-100 text-green-800 border-green-300' };
			case WorkOrderStatus.PAUSED:
				return { text: 'Paused', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
			case WorkOrderStatus.COMPLETED:
				return { text: 'Completed', class: 'bg-blue-100 text-blue-800 border-blue-300' };
			case WorkOrderStatus.PARTIAL:
				return { text: 'Partial', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
			default:
				return { text: status, class: 'bg-gray-100 text-gray-800 border-gray-300' };
		}
	}
</script>

<!-- Loading State -->
{#if loading}
	<div class="flex items-center justify-center min-h-screen">
		<div class="text-center">
			<div
				class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"
			></div>
			<p class="text-gray-600">Loading resource...</p>
		</div>
	</div>
	<!-- Error State -->
{:else if error || !resource}
	<div class="container mx-auto px-4 py-8 max-w-7xl">
		<div class="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
			<p class="font-semibold mb-2">Error</p>
			<p>{error || 'Resource not found'}</p>
			<button
				onclick={goBack}
				class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
			>
				← Back to Resources
			</button>
		</div>
	</div>
	<!-- Main Content -->
{:else}
	<div class="container mx-auto px-4 py-8 max-w-7xl">
		<!-- Header -->
		<div class="mb-6">
			<button
				onclick={goBack}
				class="mb-4 text-indigo-600 hover:text-indigo-800 transition font-medium flex items-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 19l-7-7m0 0l7-7m-7 7h18"
					/>
				</svg>
				Back to Resources
			</button>

			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-900 mb-2">{resource.name}</h1>
					<div class="flex items-center gap-4 text-sm text-gray-600">
						<span>ID: {resource.uid}</span>
						{#if resource}
							{@const status = getStatusBadge(resource)}
							<span
								class="inline-block px-3 py-1 text-xs font-semibold rounded-full border {status.class}"
							>
								{status.text}
							</span>
						{/if}
					</div>
				</div>

				<button
					onclick={handleRefresh}
					class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
				>
					🔄 Refresh
				</button>
			</div>
		</div>

		<!-- Downtime Alert -->
		{#if resource.currentDowntime?.isDown}
			<div class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
				<div class="flex items-start gap-3">
					<svg class="w-6 h-6 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<div class="flex-1">
						<p class="font-semibold text-red-900">Resource is Currently Down</p>
						<p class="text-red-800 mt-1">
							{resource.currentDowntime.reason || 'No reason specified'}
						</p>
						{#if resource.currentDowntime.startTime}
							<p class="text-sm text-red-700 mt-2">
								Since: {resource.currentDowntime.startTime.toDate().toLocaleString()}
							</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Current Work Section -->
		<div class="mb-8">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Current Work</h2>

			{#if activeWorkOrders.length === 0}
				<div class="bg-white rounded-lg shadow p-8 text-center">
					<svg
						class="w-16 h-16 mx-auto text-gray-400 mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
					<p class="text-gray-600">No active work orders</p>
					<p class="text-sm text-gray-500 mt-1">Start work from the queue below</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{#each activeWorkOrders as wo}
						{@const statusBadge = getWorkOrderStatusBadge(wo.status)}
						<div class="bg-white rounded-lg shadow border-2 border-indigo-200 p-6">
							<!-- Header -->
							<div class="flex items-start justify-between mb-4">
								<div>
									<div class="text-sm text-gray-500">Job ID</div>
									<div class="font-semibold text-gray-900">{wo.jobId}</div>
								</div>
								<span
									class="inline-block px-3 py-1 text-xs font-semibold rounded-full border {statusBadge.class}"
								>
									{statusBadge.text}
								</span>
							</div>

							<!-- Progress -->
							<div class="mb-4">
								<div class="flex justify-between text-sm mb-2">
									<span class="text-gray-600">Progress</span>
									<span class="font-semibold text-gray-900">
										{wo.quantityCompleted} / {wo.quantityTarget} units
									</span>
								</div>
								<div class="w-full bg-gray-200 rounded-full h-2">
									<div
										class="bg-indigo-600 h-2 rounded-full transition-all"
										style="width: {Math.min(
											(wo.quantityCompleted / wo.quantityTarget) * 100,
											100
										)}%"
									></div>
								</div>
							</div>

							<!-- Details -->
							<div class="space-y-2 text-sm mb-4">
								<div class="flex justify-between">
									<span class="text-gray-600">Estimated Duration:</span>
									<span class="text-gray-900 font-medium">{wo.estimatedDuration} min</span>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex gap-2 pt-4 border-t border-gray-200">
								{#if wo.status === WorkOrderStatus.ACTIVE}
									<button
										onclick={() => handlePause(wo)}
										class="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium"
									>
										⏸ Pause
									</button>
									<button
										onclick={() => openCompleteModal(wo)}
										class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
									>
										✓ Complete
									</button>
								{:else if wo.status === WorkOrderStatus.PAUSED}
									<button
										onclick={() => handleResume(wo)}
										class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
									>
										▶ Resume
									</button>
									<button
										onclick={() => openCompleteModal(wo)}
										class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
									>
										✓ Complete
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Work Queue Section -->
		<div class="mb-8">
			<h2 class="text-xl font-bold text-gray-900 mb-4">Work Queue</h2>

			{#if queuedWorkOrders.length === 0}
				<div class="bg-white rounded-lg shadow p-8 text-center">
					<svg
						class="w-16 h-16 mx-auto text-gray-400 mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<p class="text-gray-600">No work orders in queue</p>
				</div>
			{:else}
				<div class="bg-white rounded-lg shadow overflow-hidden">
					<div class="divide-y divide-gray-200">
						{#each queuedWorkOrders as wo, index}
							<div class="p-4 hover:bg-gray-50 transition">
								<div class="flex items-center justify-between">
									<!-- Left: Queue Position & Job Info -->
									<div class="flex items-center gap-4">
										<div
											class="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center"
										>
											{index + 1}
										</div>
										<div>
											<div class="text-sm text-gray-500">Job ID</div>
											<div class="font-semibold text-gray-900">{wo.jobId}</div>
										</div>
									</div>

									<!-- Middle: Details -->
									<div class="hidden md:flex gap-8 text-sm">
										<div>
											<div class="text-gray-500">Quantity</div>
											<div class="font-medium text-gray-900">{wo.quantityTarget} units</div>
										</div>
										<div>
											<div class="text-gray-500">Est. Duration</div>
											<div class="font-medium text-gray-900">{wo.estimatedDuration} min</div>
										</div>
									</div>

									<!-- Right: Action -->
									<button
										onclick={() => openStartModal(wo)}
										class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
									>
										▶ Start
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Report Downtime Button -->
		<div class="flex justify-center">
			<button
				onclick={() => (showDowntimeModal = true)}
				class="px-6 py-3 {resource.currentDowntime?.isDown
					? 'bg-green-600 hover:bg-green-700'
					: 'bg-red-600 hover:bg-red-700'} text-white rounded-lg transition font-medium shadow-lg"
			>
				{resource.currentDowntime?.isDown ? '✓ Clear Downtime' : '⚠ Report Downtime'}
			</button>
		</div>
	</div>
{/if}

<!-- Modals -->
<StartWorkModal
	bind:isOpen={showStartModal}
	workOrder={selectedWorkOrder}
	onSuccess={handleModalSuccess}
/>
<CompleteWorkModal
	bind:isOpen={showCompleteModal}
	workOrder={selectedWorkOrder}
	onSuccess={handleModalSuccess}
/>
<ReportDowntimeModal bind:isOpen={showDowntimeModal} {resource} onSuccess={handleModalSuccess} />
