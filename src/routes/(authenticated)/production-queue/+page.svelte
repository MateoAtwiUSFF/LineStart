<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser, isPM } from '$lib/stores/auth';
	import { jobsStore, filteredJobs, jobsLoading } from '$lib/stores/jobs';
	import { configStore, config, customFields } from '$lib/stores/config';

	// Load data on mount
	onMount(async () => {
		await configStore.load();
		await jobsStore.load();
	});

	// State for new job form
	let showAddJob = $state(false);
	let newJob = $state({
		projectId: '',
		quantity: 100,
		customFieldValues: {} as Record<string, any>
	});

	// Filter
	let filterText = $state('');

	// Handle filter
	function handleFilter(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		filterText = value;
		jobsStore.setFilter(value);
	}

	// Handle sort
	function handleSort(column: string) {
		jobsStore.toggleSort(column);
	}

	// Create job
	async function handleCreateJob() {
		if (!newJob.projectId || newJob.quantity <= 0) {
			alert('Please fill in all required fields');
			return;
		}

		try {
			await jobsStore.create(newJob, $currentUser!.uid);
			showAddJob = false;
			newJob = {
				projectId: '',
				quantity: 100,
				customFieldValues: {}
			};
		} catch (error) {
			console.error('Error creating job:', error);
			alert('Failed to create job');
		}
	}

	// Get status color
	function getStatusColor(status: string): string {
		const state = $config.defaultStates.find((s) => s.name.toLowerCase() === status.toLowerCase());
		return state?.color || '#6B7280';
	}

	// Refresh jobs
	async function handleRefresh() {
		await jobsStore.refresh();
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-7xl">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Production Queue</h1>
		<p class="text-gray-600">Manage and assign production jobs</p>
	</div>

	<!-- Toolbar -->
	<div class="bg-white rounded-lg shadow p-4 mb-4">
		<div class="flex flex-wrap items-center gap-4">
			<!-- Search/Filter -->
			<div class="flex-1 min-w-[200px]">
				<input
					type="text"
					placeholder="Search jobs..."
					value={filterText}
					oninput={handleFilter}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
				/>
			</div>

			<!-- Actions -->
			<div class="flex gap-2">
				{#if $isPM}
					<button
						onclick={() => (showAddJob = true)}
						class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
					>
						+ Add Job
					</button>
				{/if}

				<button
					onclick={handleRefresh}
					class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
				>
					🔄 Refresh
				</button>
			</div>
		</div>
	</div>

	<!-- Data Grid -->
	<div class="bg-white rounded-lg shadow overflow-hidden">
		{#if $jobsLoading}
			<div class="p-8 text-center">
				<div
					class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"
				></div>
				<p class="mt-4 text-gray-600">Loading jobs...</p>
			</div>
		{:else if $filteredJobs.length === 0}
			<div class="p-8 text-center">
				<p class="text-gray-500">No jobs found. {$isPM ? 'Click "Add Job" to create one.' : ''}</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50 border-b border-gray-200">
						<tr>
							<th
								class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => handleSort('projectId')}
							>
								Project ID
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => handleSort('quantity')}
							>
								Quantity
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
								onclick={() => handleSort('status')}
							>
								Status
							</th>
							{#each $customFields as field}
								<th
									class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
									onclick={() => handleSort(field.name)}
								>
									{field.name}
								</th>
							{/each}
							<th class="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each $filteredJobs as job}
							<tr class="hover:bg-gray-50 transition">
								<td class="px-4 py-3 text-sm font-medium text-gray-900">{job.projectId}</td>
								<td class="px-4 py-3 text-sm text-gray-700">{job.quantity}</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
										style="background-color: {getStatusColor(job.status)}"
									>
										{job.status}
									</span>
								</td>
								{#each $customFields as field}
									<td class="px-4 py-3 text-sm text-gray-700">
										{job.customFieldValues[field.name] || '-'}
									</td>
								{/each}
								<td class="px-4 py-3 text-right text-sm">
									<button
										class="text-indigo-600 hover:text-indigo-900 font-medium"
									>
										View
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Job count -->
	<div class="mt-4 text-sm text-gray-600">
		Showing {$filteredJobs.length} job{$filteredJobs.length !== 1 ? 's' : ''}
	</div>
</div>

<!-- Add Job Modal -->
{#if showAddJob}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) showAddJob = false;
		}}
	>
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
			<h2 class="text-2xl font-bold text-gray-900 mb-4">Add New Job</h2>

			<form onsubmit={(e) => { e.preventDefault(); handleCreateJob(); }}>
				<!-- Project ID -->
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Project ID *
					</label>
					<input
						type="text"
						bind:value={newJob.projectId}
						required
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						placeholder="e.g., PROJECT-001"
					/>
				</div>

				<!-- Quantity -->
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Quantity *
					</label>
					<input
						type="number"
						bind:value={newJob.quantity}
						required
						min="1"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					/>
				</div>

				<!-- Custom Fields -->
				{#each $customFields as field}
					<div class="mb-4">
						<label class="block text-sm font-medium text-gray-700 mb-2">
							{field.name}
							{#if field.required}*{/if}
						</label>

						{#if field.type === 'string'}
							<input
								type="text"
								bind:value={newJob.customFieldValues[field.name]}
								required={field.required}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
							/>
						{:else if field.type === 'number'}
							<input
								type="number"
								bind:value={newJob.customFieldValues[field.name]}
								required={field.required}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
							/>
						{:else if field.type === 'date'}
							<input
								type="date"
								bind:value={newJob.customFieldValues[field.name]}
								required={field.required}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
							/>
						{:else if field.type === 'boolean'}
							<input
								type="checkbox"
								bind:checked={newJob.customFieldValues[field.name]}
								class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
							/>
						{/if}
					</div>
				{/each}

				<!-- Actions -->
				<div class="flex gap-3 mt-6">
					<button
						type="submit"
						class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
					>
						Create Job
					</button>
					<button
						type="button"
						onclick={() => (showAddJob = false)}
						class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
