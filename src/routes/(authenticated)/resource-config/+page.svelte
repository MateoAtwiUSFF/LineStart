<script lang="ts">
	import { onMount } from 'svelte';
	import { resourcesStore, resources, resourcesLoading } from '$lib/stores/resources';
	import { isPM } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import AddResourceModal from '$lib/components/config/AddResourceModal.svelte';
	import EditResourceModal from '$lib/components/config/EditResourceModal.svelte';
	import ScheduleDowntimeModal from '$lib/components/config/ScheduleDowntimeModal.svelte';
	import type { Resource } from '$lib/types';

	// Modals state
	let showAddModal = $state(false);
	let showEditModal = $state(false);
	let showDowntimeModal = $state(false);
	let selectedResource = $state<Resource | null>(null);

	// Load resources on mount
	onMount(async () => {
		await resourcesStore.load();
	});

	// Refresh resources
	async function handleRefresh() {
		await resourcesStore.refresh();
	}

	// Open edit modal
	function openEditModal(resource: Resource) {
		selectedResource = resource;
		showEditModal = true;
	}

	// Open downtime modal
	function openDowntimeModal(resource: Resource) {
		selectedResource = resource;
		showDowntimeModal = true;
	}

	// Delete resource
	async function handleDelete(resource: Resource) {
		if (
			!confirm(
				`Are you sure you want to delete "${resource.name}"? This action cannot be undone.`
			)
		) {
			return;
		}

		try {
			await resourcesStore.delete(resource.id);
		} catch (error: any) {
			alert(error.message || 'Failed to delete resource');
		}
	}

	// Handle modal success
	function handleModalSuccess() {
		resourcesStore.refresh();
	}

	// Get status badge
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

	// Format days of week
	function formatDaysOfWeek(days: number[]): string {
		if (days.length === 7) return 'Every Day';
		if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) return 'Weekdays';
		if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';

		const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		return days.map((d) => dayNames[d]).join(', ');
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-7xl">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Resource Configuration</h1>
			<p class="text-gray-600">Manage resources, operating hours, and scheduled downtime</p>
		</div>

		<div class="flex gap-2">
			<button
				onclick={handleRefresh}
				class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
			>
				🔄 Refresh
			</button>

			{#if $isPM}
				<button
					onclick={() => (showAddModal = true)}
					class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
				>
					+ Add Resource
				</button>
			{/if}
		</div>
	</div>

	<!-- Access Control -->
	{#if !$isPM}
		<div class="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6">
			<p class="font-semibold">Read-Only Access</p>
			<p class="text-sm">You can view resources but cannot make changes.</p>
		</div>
	{/if}

	<!-- Resources Table -->
	{#if $resourcesLoading}
		<div class="flex items-center justify-center py-16">
			<div class="text-center">
				<div
					class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"
				></div>
				<p class="text-gray-600">Loading resources...</p>
			</div>
		</div>
	{:else if $resources.length === 0}
		<div class="bg-white rounded-lg shadow p-8 text-center">
			<svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
				/>
			</svg>
			<p class="text-gray-600 mb-4">No resources configured yet.</p>
			{#if $isPM}
				<button
					onclick={() => (showAddModal = true)}
					class="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
				>
					Add Your First Resource
				</button>
			{/if}
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<!-- Desktop Table View -->
			<div class="hidden md:block overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50 border-b border-gray-200">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
								Resource
							</th>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
								Status
							</th>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
								Operating Hours
							</th>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
								Production Rate
							</th>
							<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
								Setup Time
							</th>
							{#if $isPM}
								<th class="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
									Actions
								</th>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each $resources as resource}
							{@const status = getStatusBadge(resource)}
							<tr class="hover:bg-gray-50 transition">
								<!-- Resource Info -->
								<td class="px-6 py-4">
									<div>
										<div class="font-semibold text-gray-900">{resource.name}</div>
										<div class="text-sm text-gray-500">ID: {resource.uid}</div>
									</div>
								</td>

								<!-- Status -->
								<td class="px-6 py-4">
									<span
										class="inline-block px-3 py-1 text-xs font-semibold rounded-full border {status.class}"
									>
										{status.text}
									</span>
									{#if resource.currentDowntime?.isDown}
										<div class="text-xs text-red-700 mt-1">
											{resource.currentDowntime.reason || 'No reason specified'}
										</div>
									{/if}
								</td>

								<!-- Operating Hours -->
								<td class="px-6 py-4">
									<div class="text-sm text-gray-900">
										{resource.operationalHours.startTime} - {resource.operationalHours.endTime}
									</div>
									<div class="text-xs text-gray-500">
										{formatDaysOfWeek(resource.operationalHours.daysOfWeek)}
									</div>
									{#if resource.overtimeHours > 0}
										<div class="text-xs text-indigo-600 font-medium">
											+{resource.overtimeHours} hrs OT
										</div>
									{/if}
								</td>

								<!-- Production Rate -->
								<td class="px-6 py-4 text-sm text-gray-900">
									{resource.defaultProductionRate} units/hr
								</td>

								<!-- Setup Time -->
								<td class="px-6 py-4 text-sm text-gray-900">{resource.setupTime} min</td>

								<!-- Actions -->
								{#if $isPM}
									<td class="px-6 py-4">
										<div class="flex items-center justify-end gap-2">
											<button
												onclick={() => openEditModal(resource)}
												class="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition"
												title="Edit resource"
											>
												Edit
											</button>
											<button
												onclick={() => openDowntimeModal(resource)}
												class="px-3 py-1 text-sm text-amber-600 hover:text-amber-800 font-medium transition"
												title="Schedule downtime"
											>
												Downtime
											</button>
											<button
												onclick={() => handleDelete(resource)}
												class="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium transition"
												title="Delete resource"
											>
												Delete
											</button>
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile Card View -->
			<div class="md:hidden divide-y divide-gray-200">
				{#each $resources as resource}
					{@const status = getStatusBadge(resource)}
					<div class="p-4 space-y-3">
						<!-- Header -->
						<div class="flex items-start justify-between">
							<div>
								<div class="font-semibold text-gray-900">{resource.name}</div>
								<div class="text-sm text-gray-500">ID: {resource.uid}</div>
							</div>
							<span
								class="inline-block px-3 py-1 text-xs font-semibold rounded-full border {status.class}"
							>
								{status.text}
							</span>
						</div>

						<!-- Details -->
						<div class="space-y-2 text-sm">
							<div class="flex justify-between">
								<span class="text-gray-600">Operating Hours:</span>
								<span class="text-gray-900 font-medium">
									{resource.operationalHours.startTime} - {resource.operationalHours.endTime}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Operating Days:</span>
								<span class="text-gray-900 font-medium">
									{formatDaysOfWeek(resource.operationalHours.daysOfWeek)}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Production Rate:</span>
								<span class="text-gray-900 font-medium">
									{resource.defaultProductionRate} units/hr
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-600">Setup Time:</span>
								<span class="text-gray-900 font-medium">{resource.setupTime} min</span>
							</div>
							{#if resource.overtimeHours > 0}
								<div class="flex justify-between">
									<span class="text-gray-600">Overtime:</span>
									<span class="text-indigo-600 font-medium">+{resource.overtimeHours} hrs</span>
								</div>
							{/if}
						</div>

						<!-- Actions -->
						{#if $isPM}
							<div class="flex gap-2 pt-2 border-t border-gray-200">
								<button
									onclick={() => openEditModal(resource)}
									class="flex-1 px-3 py-2 text-sm text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition font-medium"
								>
									Edit
								</button>
								<button
									onclick={() => openDowntimeModal(resource)}
									class="flex-1 px-3 py-2 text-sm text-amber-600 border border-amber-300 rounded-lg hover:bg-amber-50 transition font-medium"
								>
									Downtime
								</button>
								<button
									onclick={() => handleDelete(resource)}
									class="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition font-medium"
								>
									Delete
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Resource count -->
		<div class="mt-6 text-sm text-gray-600 text-center">
			{$resources.length} resource{$resources.length !== 1 ? 's' : ''} configured
		</div>
	{/if}
</div>

<!-- Modals -->
<AddResourceModal bind:isOpen={showAddModal} onSuccess={handleModalSuccess} />
<EditResourceModal
	bind:isOpen={showEditModal}
	resource={selectedResource}
	onSuccess={handleModalSuccess}
/>
<ScheduleDowntimeModal
	bind:isOpen={showDowntimeModal}
	resource={selectedResource}
	onSuccess={handleModalSuccess}
/>
