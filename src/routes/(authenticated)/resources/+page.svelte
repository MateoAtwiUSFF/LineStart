<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isPM } from '$lib/stores/auth';
	import { resourcesStore, resources, resourcesLoading } from '$lib/stores/resources';
	import { getWorkOrdersForResource } from '$lib/utils/firestore';
	import { WorkOrderStatus } from '$lib/types';

	// Track work order counts per resource
	let resourceWorkOrderCounts = $state<Map<string, { queued: number; active: number }>>(new Map());

	// Load resources on mount
	onMount(async () => {
		await resourcesStore.load();
		await loadWorkOrderCounts();
	});

	// Load work order counts for all resources
	async function loadWorkOrderCounts() {
		const counts = new Map<string, { queued: number; active: number }>();

		for (const resource of $resources) {
			try {
				const workOrders = await getWorkOrdersForResource(resource.id);
				const queued = workOrders.filter(wo => wo.status === WorkOrderStatus.QUEUED).length;
				const active = workOrders.filter(wo =>
					wo.status === WorkOrderStatus.ACTIVE || wo.status === WorkOrderStatus.PAUSED
				).length;
				counts.set(resource.id, { queued, active });
			} catch (err) {
				console.error(`Error loading work orders for resource ${resource.id}:`, err);
				counts.set(resource.id, { queued: 0, active: 0 });
			}
		}

		resourceWorkOrderCounts = counts;
	}

	// Get work order counts for a resource
	function getWorkOrderCounts(resourceId: string) {
		return resourceWorkOrderCounts.get(resourceId) || { queued: 0, active: 0 };
	}

	// Navigate to resource page
	function viewResource(resourceId: string) {
		goto(`/resources/${resourceId}`);
	}

	// Get status badge
	function getStatusBadge(resource: any) {
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

	// Refresh
	async function handleRefresh() {
		await resourcesStore.refresh();
		await loadWorkOrderCounts();
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-7xl">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Resources</h1>
			<p class="text-gray-600">View and manage production resources</p>
		</div>

		<div class="flex gap-2">
			{#if $isPM}
				<a
					href="/resource-config"
					class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
				>
					⚙️ Configure
				</a>
			{/if}

			<button
				onclick={handleRefresh}
				class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
			>
				🔄 Refresh
			</button>
		</div>
	</div>

	<!-- Resources Grid -->
	{#if $resourcesLoading}
		<div class="flex items-center justify-center py-16">
			<div class="text-center">
				<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
				<p class="text-gray-600">Loading resources...</p>
			</div>
		</div>
	{:else if $resources.length === 0}
		<div class="bg-white rounded-lg shadow p-8 text-center">
			<svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
			</svg>
			<p class="text-gray-600 mb-4">No resources found.</p>
			{#if $isPM}
				<a
					href="/resource-config"
					class="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
				>
					Add Your First Resource
				</a>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each $resources as resource}
				{@const status = getStatusBadge(resource)}
				<div
					class="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer border-2 border-transparent hover:border-indigo-200"
					onclick={() => viewResource(resource.id)}
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && viewResource(resource.id)}
				>
					<!-- Card Header -->
					<div class="p-6 border-b border-gray-200">
						<div class="flex items-start justify-between mb-2">
							<div>
								<h3 class="text-xl font-bold text-gray-900">{resource.name}</h3>
								<p class="text-sm text-gray-500">ID: {resource.uid}</p>
							</div>
							<span
								class="px-3 py-1 text-xs font-semibold rounded-full border {status.class}"
							>
								{status.text}
							</span>
						</div>

						{#if resource.currentDowntime?.isDown}
							<div class="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
								<p class="font-semibold text-red-800">🔧 Downtime Reason:</p>
								<p class="text-red-700">{resource.currentDowntime.reason || 'No reason specified'}</p>
							</div>
						{/if}
					</div>

					<!-- Card Body -->
					<div class="p-6 space-y-4">
						<!-- Pending Work Orders -->
						<div class="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
							<div class="flex items-center gap-2">
								<div class="w-2 h-2 bg-blue-500 rounded-full"></div>
								<span class="text-sm font-medium text-gray-700">Pending</span>
							</div>
							<span class="text-lg font-bold text-blue-600">
								{getWorkOrderCounts(resource.id).queued}
							</span>
						</div>

						<!-- Active Work Orders -->
						<div class="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
							<div class="flex items-center gap-2">
								<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
								<span class="text-sm font-medium text-gray-700">Active</span>
							</div>
							<span class="text-lg font-bold text-green-600">
								{getWorkOrderCounts(resource.id).active}
							</span>
						</div>
					</div>

					<!-- Card Footer -->
					<div class="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
						<button
							onclick={(e) => {
								e.stopPropagation();
								viewResource(resource.id);
							}}
							class="w-full text-center text-indigo-600 hover:text-indigo-800 font-medium text-sm"
						>
							View Details →
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Resource count -->
		<div class="mt-6 text-sm text-gray-600 text-center">
			{$resources.length} resource{$resources.length !== 1 ? 's' : ''} available
		</div>
	{/if}
</div>
