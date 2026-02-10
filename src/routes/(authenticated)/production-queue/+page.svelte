<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser, isPM } from '$lib/stores/auth';
	import { jobsStore, filteredJobs, jobsLoading } from '$lib/stores/jobs';
	import { configStore, config, customFields } from '$lib/stores/config';
	import { resourcesStore, resources } from '$lib/stores/resources';
	import { importJobsFromCSV, exportJobsToCSV, downloadCSV } from '$lib/utils/csv';
	import { calculateDuration } from '$lib/utils/calculations';
	import {
		createWorkOrder,
		addAssignedWorkOrder,
		updateJob,
		getAllResources,
		getWorkOrdersForJob,
		deleteWorkOrder,
		removeAssignedWorkOrder
	} from '$lib/utils/firestore';
	import { Timestamp } from 'firebase/firestore';
	import type { CreateWorkOrderInput, Resource, Job } from '$lib/types';
	import { WorkOrderType, WorkOrderStatus, Priority, JobStatus } from '$lib/types';
	import ViewJobModal from '$lib/components/pq/ViewJobModal.svelte';

	// Load data on mount
	onMount(async () => {
		await Promise.all([
			configStore.load(),
			jobsStore.load(),
			resourcesStore.load(),
			loadResources()
		]);
		await loadJobAssignments();
	});

	// Load resources list (for dropdowns)
	let allResources = $state<Resource[]>([]);

	async function loadResources() {
		try {
			allResources = await getAllResources();
		} catch (err: any) {
			console.error('Error loading resources:', err);
		}
	}

	// Load job-to-resource assignments
	async function loadJobAssignments() {
		const assignments = new Map<string, string[]>();

		for (const job of $filteredJobs) {
			if (job.status !== 'unassigned') {
				try {
					const workOrders = await getWorkOrdersForJob(job.id);
					// Only show active work orders (queued, active, paused) - exclude completed/partial
					const activeWorkOrders = workOrders.filter(
						wo => wo.status === WorkOrderStatus.QUEUED ||
						      wo.status === WorkOrderStatus.ACTIVE ||
						      wo.status === WorkOrderStatus.PAUSED
					);
					const resourceUids = activeWorkOrders
						.map((wo) => {
							const resource = allResources.find((r) => r.id === wo.resourceId);
							return resource?.uid;
						})
						.filter((uid): uid is string => uid !== undefined);

					// Get unique resource UIDs
					const uniqueUids = Array.from(new Set(resourceUids));
					if (uniqueUids.length > 0) {
						assignments.set(job.id, uniqueUids);
					}
				} catch (err) {
					console.error(`Error loading assignments for job ${job.id}:`, err);
				}
			}
		}

		jobResourceAssignments = assignments;
	}

	// State
	let showAddJob = $state(false);
	let showImportCSV = $state(false);
	let importStatus = $state<{ success: string[]; errors: Array<{ row: number; error: string }> } | null>(null);

	let newJob = $state({
		projectId: '',
		quantity: 100,
		customFieldValues: {} as Record<string, any>
	});

	let filterText = $state('');
	let csvFile: File | null = null;

	// Batch assignment state
	let pendingAssignments = $state<Map<string, string>>(new Map()); // Map<jobId, resourceId>
	let showViewModal = $state(false);
	let selectedJob = $state<Job | null>(null);

	// Track which resources are assigned to each job
	let jobResourceAssignments = $state<Map<string, string[]>>(new Map()); // Map<jobId, resourceUids[]>

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

	// Handle CSV file selection
	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		csvFile = input.files?.[0] || null;
	}

	// Import CSV
	async function handleImportCSV() {
		if (!csvFile) {
			alert('Please select a CSV file');
			return;
		}

		try {
			const csvContent = await csvFile.text();
			const result = await importJobsFromCSV(csvContent, $config, $currentUser!.uid);

			importStatus = result;

			if (result.success.length > 0) {
				await jobsStore.refresh();
			}

			// Auto-close if all succeeded
			if (result.errors.length === 0) {
				setTimeout(() => {
					showImportCSV = false;
					importStatus = null;
					csvFile = null;
				}, 2000);
			}
		} catch (error) {
			console.error('Error importing CSV:', error);
			alert('Failed to import CSV');
		}
	}

	// Export CSV
	function handleExportCSV() {
		const csvContent = exportJobsToCSV($filteredJobs, $config);
		const timestamp = new Date().toISOString().split('T')[0];
		downloadCSV(csvContent, `linestart-jobs-${timestamp}.csv`);
	}

	// Get status color
	function getStatusColor(status: string): string {
		const state = $config.defaultStates.find((s) => s.name.toLowerCase() === status.toLowerCase());
		return state?.color || '#6B7280';
	}

	// Refresh
	async function handleRefresh() {
		await jobsStore.refresh();
		await loadJobAssignments();
	}

	// Handle assignment dropdown change
	function handleAssignmentChange(jobId: string, resourceId: string) {
		if (resourceId === '') {
			// User selected "Select resource..." (empty) - remove assignment
			pendingAssignments.delete(jobId);
		} else {
			// User selected a resource - add to pending
			pendingAssignments.set(jobId, resourceId);
		}
		// Trigger reactivity
		pendingAssignments = new Map(pendingAssignments);
	}

	// Open ViewJobModal
	function openViewModal(job: Job) {
		selectedJob = job;
		showViewModal = true;
	}

	// Close ViewJobModal
	function closeViewModal() {
		showViewModal = false;
		selectedJob = null;
	}

	// Push all pending assignments
	async function handlePushAssignments() {
		if (pendingAssignments.size === 0) return;

		try {
			// For each pending assignment, create work order
			for (const [jobId, resourceId] of pendingAssignments.entries()) {
				// Get job details
				const job = $filteredJobs.find((j) => j.id === jobId);
				if (!job) continue;

				// Get resource details for duration calculation
				const resource = allResources.find((r) => r.id === resourceId);
				if (!resource) continue;

				// Calculate estimated duration
				const estimatedDuration = calculateDuration(
					resource.setupTime,
					job.quantity,
					resource.defaultProductionRate
				);

				// Create work order data
				const workOrderData: CreateWorkOrderInput = {
					jobId,
					resourceId,
					type: WorkOrderType.PRODUCTION,
					priority: Priority.NORMAL,
					status: WorkOrderStatus.QUEUED,
					quantityTarget: job.quantity,
					quantityCompleted: 0,
					estimatedDuration,
					scheduledStart: null,
					assignedBy: $currentUser!.uid
				};

				// Create work order
				const workOrderId = await createWorkOrder(jobId, workOrderData, $currentUser!.uid);

				// Add to resource's assigned work orders
				await addAssignedWorkOrder(resourceId, {
					workOrderId,
					jobId,
					position: 0, // Add to front of queue
					addedAt: Timestamp.now()
				});

				// Update job status to 'assigned'
				await updateJob(jobId, { status: JobStatus.ASSIGNED }, $currentUser!.uid);
			}

			// Clear pending assignments
			pendingAssignments.clear();
			pendingAssignments = new Map();

			// Refresh jobs
			await jobsStore.refresh();

			// Reload assignments to show updated resource assignments
			await loadJobAssignments();
		} catch (err: any) {
			console.error('Error pushing assignments:', err);
			alert(err.message || 'Failed to create work orders');
		}
	}

	// Get assigned resources display text for a job
	function getAssignedResourcesText(jobId: string): string {
		const resourceUids = jobResourceAssignments.get(jobId);
		if (!resourceUids || resourceUids.length === 0) {
			return '—';
		}
		return resourceUids.join(', ');
	}

	// Unassign a job
	async function handleUnassign(job: Job) {
		if (!confirm(`Are you sure you want to unassign job ${job.projectId}? This will delete all associated work orders.`)) {
			return;
		}

		try {
			// Get all work orders for this job
			const workOrders = await getWorkOrdersForJob(job.id);

			// Only delete active work orders (queued, active, paused)
			const activeWorkOrders = workOrders.filter(
				wo => wo.status === WorkOrderStatus.QUEUED ||
				      wo.status === WorkOrderStatus.ACTIVE ||
				      wo.status === WorkOrderStatus.PAUSED
			);

			// Delete each active work order
			for (const wo of activeWorkOrders) {
				// Remove from resource's assigned work orders
				await removeAssignedWorkOrder(wo.resourceId, wo.id);

				// Delete the work order itself
				await deleteWorkOrder(job.id, wo.id);
			}

			// Update job status to unassigned
			await updateJob(job.id, { status: JobStatus.UNASSIGNED }, $currentUser!.uid);

			// Refresh data
			await jobsStore.refresh();
			await loadJobAssignments();
		} catch (err: any) {
			console.error('Error unassigning job:', err);
			alert(err.message || 'Failed to unassign job');
		}
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
			<div class="flex flex-wrap gap-2">
				{#if $isPM}
					<button
						onclick={() => (showAddJob = true)}
						class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
					>
						+ Add Job
					</button>

					<button
						onclick={() => (showImportCSV = true)}
						class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
					>
						📁 Import CSV
					</button>
				{/if}

				<button
					onclick={handleExportCSV}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
				>
					📥 Export CSV
				</button>

				<button
					onclick={handleRefresh}
					class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
				>
					🔄 Refresh
				</button>

				{#if $isPM}
					<button
						onclick={handlePushAssignments}
						disabled={pendingAssignments.size === 0}
						class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
					>
						Push Assignments{#if pendingAssignments.size > 0} ({pendingAssignments.size}){/if}
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Data Grid -->
	<div class="bg-white rounded-lg shadow overflow-hidden">
		{#if $jobsLoading}
			<div class="p-8 text-center">
				<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
				<p class="mt-4 text-gray-600">Loading jobs...</p>
			</div>
		{:else if $filteredJobs.length === 0}
			<div class="p-8 text-center">
				<p class="text-gray-500">
					No jobs found. {$isPM ? 'Click "Add Job" or "Import CSV" to create jobs.' : ''}
				</p>
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
							{#if $isPM}
								<th
									class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
								>
									Assign
								</th>
							{/if}
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
								{#if $isPM}
									<td class="px-4 py-3">
										{#if job.status === 'unassigned'}
											<select
												value={pendingAssignments.get(job.id) || ''}
												onchange={(e) => handleAssignmentChange(job.id, e.currentTarget.value)}
												class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
											>
												<option value="">Select resource...</option>
												{#each allResources as resource}
													<option value={resource.id}>{resource.uid}</option>
												{/each}
											</select>
										{:else}
											<div class="flex items-center gap-2">
												<span class="text-sm text-gray-700">{getAssignedResourcesText(job.id)}</span>
												<button
													onclick={(e) => {
														e.stopPropagation();
														handleUnassign(job);
													}}
													class="text-red-600 hover:text-red-800 hover:bg-red-50 rounded px-1.5 py-0.5 transition text-sm font-bold"
													title="Unassign job"
												>
													×
												</button>
											</div>
										{/if}
									</td>
								{/if}
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
								<td class="px-4 py-3 text-right text-sm space-x-2">
									<button
										onclick={() => openViewModal(job)}
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
		onclick={(e) => e.target === e.currentTarget && (showAddJob = false)}
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
			<h2 class="text-2xl font-bold text-gray-900 mb-4">Add New Job</h2>

			<form onsubmit={(e) => { e.preventDefault(); handleCreateJob(); }}>
				<div class="mb-4">
					<label for="projectId" class="block text-sm font-medium text-gray-700 mb-2">
						Project ID *
					</label>
					<input
						id="projectId"
						type="text"
						bind:value={newJob.projectId}
						required
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						placeholder="e.g., PROJECT-001"
					/>
				</div>

				<div class="mb-4">
					<label for="quantity" class="block text-sm font-medium text-gray-700 mb-2">
						Quantity *
					</label>
					<input
						id="quantity"
						type="number"
						bind:value={newJob.quantity}
						required
						min="1"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					/>
				</div>

				{#each $customFields as field}
					<div class="mb-4">
						<label for={field.name} class="block text-sm font-medium text-gray-700 mb-2">
							{field.name}
							{#if field.required}*{/if}
						</label>

						{#if field.type === 'string'}
							<input
								id={field.name}
								type="text"
								bind:value={newJob.customFieldValues[field.name]}
								required={field.required}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
							/>
						{:else if field.type === 'number'}
							<input
								id={field.name}
								type="number"
								bind:value={newJob.customFieldValues[field.name]}
								required={field.required}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
							/>
						{:else if field.type === 'date'}
							<input
								id={field.name}
								type="date"
								bind:value={newJob.customFieldValues[field.name]}
								required={field.required}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
							/>
						{:else if field.type === 'boolean'}
							<input
								id={field.name}
								type="checkbox"
								bind:checked={newJob.customFieldValues[field.name]}
								class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
							/>
						{/if}
					</div>
				{/each}

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

<!-- Import CSV Modal -->
{#if showImportCSV}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		onclick={(e) => e.target === e.currentTarget && (showImportCSV = false)}
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
			<h2 class="text-2xl font-bold text-gray-900 mb-4">Import Jobs from CSV</h2>

			{#if !importStatus}
				<div class="mb-4">
					<label for="csvFile" class="block text-sm font-medium text-gray-700 mb-2">
						Select CSV File
					</label>
					<input
						id="csvFile"
						type="file"
						accept=".csv"
						onchange={handleFileSelect}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					/>
					<p class="mt-2 text-xs text-gray-500">
						CSV should include: projectId, quantity, and any custom fields
					</p>
				</div>

				<div class="flex gap-3 mt-6">
					<button
						onclick={handleImportCSV}
						disabled={!csvFile}
						class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Import
					</button>
					<button
						onclick={() => {
							showImportCSV = false;
							csvFile = null;
						}}
						class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
					>
						Cancel
					</button>
				</div>
			{:else}
				<!-- Import Results -->
				<div class="space-y-4">
					{#if importStatus.success.length > 0}
						<div class="p-4 bg-green-50 border border-green-200 rounded-lg">
							<p class="font-semibold text-green-800">
								✅ Successfully imported {importStatus.success.length} job{importStatus.success.length !== 1 ? 's' : ''}
							</p>
						</div>
					{/if}

					{#if importStatus.errors.length > 0}
						<div class="p-4 bg-red-50 border border-red-200 rounded-lg max-h-64 overflow-y-auto">
							<p class="font-semibold text-red-800 mb-2">
								❌ {importStatus.errors.length} error{importStatus.errors.length !== 1 ? 's' : ''}
							</p>
							<ul class="list-disc list-inside space-y-1 text-sm text-red-700">
								{#each importStatus.errors as error}
									<li>Row {error.row}: {error.error}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<button
						onclick={() => {
							showImportCSV = false;
							importStatus = null;
							csvFile = null;
						}}
						class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
					>
						Close
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- View Job Modal -->
<ViewJobModal bind:isOpen={showViewModal} job={selectedJob} onClose={closeViewModal} />
