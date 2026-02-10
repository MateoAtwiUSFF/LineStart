<script lang="ts">
	import { onMount } from 'svelte';
	import { getAllGanttEntries, getAllResources } from '$lib/utils/firestore';
	import type { GanttEntry, Resource } from '$lib/types';
	import { WorkOrderStatus } from '$lib/types';

	// State
	let ganttEntries = $state<GanttEntry[]>([]);
	let resources = $state<Resource[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Date range filtering
	let startDate = $state('');
	let endDate = $state('');
	let viewMode = $state<'day' | 'week' | 'month'>('week');

	// Hover state for tooltips
	let hoveredEntry = $state<GanttEntry | null>(null);
	let tooltipPosition = $state({ x: 0, y: 0 });

	// Initialize date range to current week
	onMount(async () => {
		const today = new Date();
		const weekStart = new Date(today);
		weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 13); // 2 weeks

		startDate = weekStart.toISOString().split('T')[0];
		endDate = weekEnd.toISOString().split('T')[0];

		await loadData();
	});

	// Load gantt entries and resources
	async function loadData() {
		loading = true;
		error = null;

		try {
			[ganttEntries, resources] = await Promise.all([getAllGanttEntries(), getAllResources()]);
		} catch (err: any) {
			console.error('Error loading gantt data:', err);
			error = err.message || 'Failed to load gantt data';
		} finally {
			loading = false;
		}
	}

	// Filter entries by date range
	let filteredEntries = $derived.by(() => {
		if (!startDate || !endDate) return ganttEntries;

		const start = new Date(startDate);
		const end = new Date(endDate);
		end.setHours(23, 59, 59, 999); // Include full end date

		return ganttEntries.filter((entry) => {
			const entryStart = entry.scheduledStart.toDate();
			const entryEnd = entry.scheduledEnd.toDate();

			// Include if entry overlaps with date range
			return entryStart <= end && entryEnd >= start;
		});
	});

	// Group entries by resource
	let entriesByResource = $derived.by(() => {
		const grouped = new Map<string, GanttEntry[]>();

		filteredEntries.forEach((entry) => {
			if (!grouped.has(entry.resourceId)) {
				grouped.set(entry.resourceId, []);
			}
			grouped.get(entry.resourceId)!.push(entry);
		});

		return grouped;
	});

	// Calculate timeline parameters
	let timelineParams = $derived.by(() => {
		if (!startDate || !endDate) {
			return { start: new Date(), end: new Date(), totalDays: 0, pixelsPerDay: 100 };
		}

		const start = new Date(startDate);
		const end = new Date(endDate);
		const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const pixelsPerDay = viewMode === 'day' ? 150 : viewMode === 'week' ? 60 : 30;

		return { start, end, totalDays, pixelsPerDay };
	});

	// Get position and width for an entry
	function getEntryStyle(entry: GanttEntry): string {
		const { start, pixelsPerDay } = timelineParams;
		const entryStart = entry.scheduledStart.toDate();
		const entryEnd = entry.scheduledEnd.toDate();

		const daysFromStart = (entryStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
		const duration = (entryEnd.getTime() - entryStart.getTime()) / (1000 * 60 * 60 * 24);

		const left = daysFromStart * pixelsPerDay;
		const width = Math.max(duration * pixelsPerDay, 2); // Minimum 2px width

		return `left: ${left}px; width: ${width}px;`;
	}

	// Get color for work order status
	function getStatusColor(status: WorkOrderStatus): string {
		switch (status) {
			case WorkOrderStatus.QUEUED:
				return 'bg-gray-400';
			case WorkOrderStatus.ACTIVE:
				return 'bg-green-500';
			case WorkOrderStatus.PAUSED:
				return 'bg-yellow-500';
			case WorkOrderStatus.COMPLETED:
				return 'bg-blue-500';
			case WorkOrderStatus.PARTIAL:
				return 'bg-indigo-500';
			default:
				return 'bg-gray-400';
		}
	}

	// Handle entry hover
	function handleEntryHover(entry: GanttEntry, event: MouseEvent) {
		hoveredEntry = entry;
		tooltipPosition = {
			x: event.clientX,
			y: event.clientY
		};
	}

	// Handle refresh
	async function handleRefresh() {
		await loadData();
	}

	// Format date for display
	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Format date and time for tooltip
	function formatDateTime(timestamp: any): string {
		const date = timestamp.toDate();
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-full">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900 mb-4">Gantt Chart</h1>

		<!-- Filters -->
		<div class="bg-white rounded-lg shadow p-4 mb-4">
			<div class="flex flex-wrap items-end gap-4">
				<!-- Date Range -->
				<div class="flex-1 min-w-[200px]">
					<label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">
						Start Date
					</label>
					<input
						id="start-date"
						type="date"
						bind:value={startDate}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					/>
				</div>

				<div class="flex-1 min-w-[200px]">
					<label for="end-date" class="block text-sm font-medium text-gray-700 mb-1">
						End Date
					</label>
					<input
						id="end-date"
						type="date"
						bind:value={endDate}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					/>
				</div>

				<!-- View Mode -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">View Mode</label>
					<div class="flex gap-2">
						<button
							onclick={() => (viewMode = 'day')}
							class="px-3 py-2 text-sm rounded-lg border transition {viewMode === 'day'
								? 'bg-indigo-600 text-white border-indigo-600'
								: 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}"
						>
							Day
						</button>
						<button
							onclick={() => (viewMode = 'week')}
							class="px-3 py-2 text-sm rounded-lg border transition {viewMode === 'week'
								? 'bg-indigo-600 text-white border-indigo-600'
								: 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}"
						>
							Week
						</button>
						<button
							onclick={() => (viewMode = 'month')}
							class="px-3 py-2 text-sm rounded-lg border transition {viewMode === 'month'
								? 'bg-indigo-600 text-white border-indigo-600'
								: 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}"
						>
							Month
						</button>
					</div>
				</div>

				<!-- Refresh Button -->
				<button
					onclick={handleRefresh}
					class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
				>
					🔄 Refresh
				</button>
			</div>
		</div>

		<!-- Legend -->
		<div class="bg-white rounded-lg shadow p-4">
			<div class="flex flex-wrap gap-4 text-sm">
				<div class="flex items-center gap-2">
					<div class="w-6 h-3 bg-gray-400 rounded"></div>
					<span class="text-gray-700">Queued</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-6 h-3 bg-green-500 rounded"></div>
					<span class="text-gray-700">Active</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-6 h-3 bg-yellow-500 rounded"></div>
					<span class="text-gray-700">Paused</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-6 h-3 bg-blue-500 rounded"></div>
					<span class="text-gray-700">Completed</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-6 h-3 bg-indigo-500 rounded"></div>
					<span class="text-gray-700">Partial</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Gantt Chart -->
	{#if loading}
		<div class="bg-white rounded-lg shadow p-16 text-center">
			<div
				class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"
			></div>
			<p class="text-gray-600">Loading schedule...</p>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
			<p class="font-semibold">Error</p>
			<p>{error}</p>
		</div>
	{:else if filteredEntries.length === 0}
		<div class="bg-white rounded-lg shadow p-16 text-center">
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
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
				/>
			</svg>
			<p class="text-gray-600 mb-2">No scheduled work orders in this date range</p>
			<p class="text-sm text-gray-500">
				Try adjusting your date range or add work orders from the Production Queue
			</p>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<div class="overflow-x-auto">
				<div class="inline-block min-w-full">
					<!-- Timeline Header -->
					<div class="flex border-b border-gray-200 bg-gray-50">
						<div class="w-48 flex-shrink-0 px-4 py-3 font-semibold text-gray-700">Resource</div>
						<div
							class="relative"
							style="width: {timelineParams.totalDays * timelineParams.pixelsPerDay}px;"
						>
							<div class="flex h-12">
								{#each Array.from({ length: timelineParams.totalDays }, (_, i) => i) as dayOffset}
									{@const date = new Date(timelineParams.start)}
									{#if date.setDate(timelineParams.start.getDate() + dayOffset)}
										<div
											class="border-l border-gray-300 px-2 py-1 text-xs text-gray-600"
											style="width: {timelineParams.pixelsPerDay}px;"
										>
											{formatDate(date)}
										</div>
									{/if}
								{/each}
							</div>
						</div>
					</div>

					<!-- Resource Rows -->
					{#each resources as resource}
						{@const resourceEntries = entriesByResource.get(resource.id) || []}
						<div class="flex border-b border-gray-200 hover:bg-gray-50">
							<!-- Resource Name -->
							<div class="w-48 flex-shrink-0 px-4 py-6 border-r border-gray-200">
								<div class="font-medium text-gray-900">{resource.name}</div>
								<div class="text-xs text-gray-500">{resource.uid}</div>
							</div>

							<!-- Timeline -->
							<div
								class="relative py-6"
								style="width: {timelineParams.totalDays * timelineParams.pixelsPerDay}px; min-height: 60px;"
							>
								{#if resourceEntries.length === 0}
									<div
										class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"
									>
										No work scheduled
									</div>
								{:else}
									{#each resourceEntries as entry}
										<div
											class="absolute h-8 rounded cursor-pointer shadow-sm hover:shadow-md transition {getStatusColor(
												entry.status
											)} opacity-80 hover:opacity-100"
											style="{getEntryStyle(entry)} top: 12px;"
											onmouseenter={(e) => handleEntryHover(entry, e)}
											onmouseleave={() => (hoveredEntry = null)}
											role="button"
											tabindex="0"
										>
											<div class="px-2 py-1 text-xs text-white truncate">
												{entry.projectId}
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Tooltip -->
{#if hoveredEntry}
	<div
		class="fixed z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg max-w-xs pointer-events-none"
		style="left: {tooltipPosition.x + 10}px; top: {tooltipPosition.y + 10}px;"
	>
		<div class="space-y-1 text-sm">
			<div class="font-semibold border-b border-gray-700 pb-1">{hoveredEntry.projectId}</div>
			<div class="text-gray-300">Job: {hoveredEntry.jobId}</div>
			<div class="text-gray-300">Resource: {hoveredEntry.resourceName}</div>
			<div class="text-gray-300">Quantity: {hoveredEntry.quantity} units</div>
			<div class="text-gray-300">Status: {hoveredEntry.status}</div>
			<div class="text-gray-300 text-xs mt-2 pt-2 border-t border-gray-700">
				<div>Start: {formatDateTime(hoveredEntry.scheduledStart)}</div>
				<div>End: {formatDateTime(hoveredEntry.scheduledEnd)}</div>
			</div>
		</div>
	</div>
{/if}
