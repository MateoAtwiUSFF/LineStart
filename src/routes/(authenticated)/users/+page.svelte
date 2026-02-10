<script lang="ts">
	import { onMount } from 'svelte';
	import { getAllUsers, deleteUser } from '$lib/utils/firestore';
	import { currentUser, isAdmin, isPM } from '$lib/stores/auth';
	import { UserRole, type User } from '$lib/types';
	import AddUserModal from '$lib/components/users/AddUserModal.svelte';
	import EditUserModal from '$lib/components/users/EditUserModal.svelte';

	// State
	let users = $state<User[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filter state
	let roleFilter = $state<'all' | UserRole>('all');
	let searchQuery = $state('');

	// Modal state
	let showAddModal = $state(false);
	let showEditModal = $state(false);
	let selectedUser = $state<User | null>(null);

	// Load users on mount
	onMount(async () => {
		await loadUsers();
	});

	// Load users
	async function loadUsers() {
		loading = true;
		error = null;

		try {
			users = await getAllUsers();
		} catch (err: any) {
			console.error('Error loading users:', err);
			error = err.message || 'Failed to load users';
		} finally {
			loading = false;
		}
	}

	// Filtered users
	let filteredUsers = $derived.by(() => {
		let filtered = users;

		// Apply role filter
		if (roleFilter !== 'all') {
			filtered = filtered.filter((u) => u.role === roleFilter);
		}

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(u) =>
					u.displayName.toLowerCase().includes(query) ||
					u.email.toLowerCase().includes(query) ||
					u.uid.toLowerCase().includes(query)
			);
		}

		return filtered;
	});

	// Handle refresh
	async function handleRefresh() {
		await loadUsers();
	}

	// Open edit modal
	function openEditModal(user: User) {
		selectedUser = user;
		showEditModal = true;
	}

	// Handle delete
	async function handleDelete(user: User) {
		// Prevent deleting self
		if (user.uid === $currentUser?.uid) {
			alert('You cannot delete your own account');
			return;
		}

		// PMs can only delete RO users
		if ($isPM && user.role !== UserRole.RO) {
			alert('You can only delete Resource Operator accounts');
			return;
		}

		if (!confirm(`Are you sure you want to delete user "${user.displayName}"? This action cannot be undone.`)) {
			return;
		}

		try {
			await deleteUser(user.uid);
			await loadUsers();
		} catch (err: any) {
			alert(err.message || 'Failed to delete user');
		}
	}

	// Handle modal success
	function handleModalSuccess() {
		loadUsers();
	}

	// Get role badge
	function getRoleBadge(role: UserRole) {
		switch (role) {
			case UserRole.ADMIN:
				return { text: 'Admin', class: 'bg-purple-100 text-purple-800 border-purple-200' };
			case UserRole.PM:
				return { text: 'PM', class: 'bg-blue-100 text-blue-800 border-blue-200' };
			case UserRole.RO:
				return { text: 'RO', class: 'bg-green-100 text-green-800 border-green-200' };
			default:
				return { text: role, class: 'bg-gray-100 text-gray-800 border-gray-200' };
		}
	}

	// Format date
	function formatDate(timestamp: any): string {
		if (!timestamp || !timestamp.toDate) return 'N/A';
		const date = timestamp.toDate();
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Can manage user (edit/delete)
	function canManageUser(user: User): boolean {
		if (!$currentUser) return false;
		if ($isAdmin) return true; // Admin can manage all
		if ($isPM && user.role === UserRole.RO) return true; // PM can manage RO
		return false;
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-7xl">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
		<p class="text-gray-600">Manage user accounts and roles</p>
	</div>

	<!-- Access Control Message -->
	{#if !$isAdmin && !$isPM}
		<div class="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-lg mb-6">
			<p class="font-semibold">Access Denied</p>
			<p class="text-sm">You do not have permission to manage users.</p>
		</div>
	{:else}
		<!-- Controls -->
		<div class="bg-white rounded-lg shadow p-4 mb-6">
			<div class="flex flex-wrap items-center gap-4">
				<!-- Search -->
				<div class="flex-1 min-w-[200px]">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search users..."
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					/>
				</div>

				<!-- Role Filter -->
				<div>
					<select
						bind:value={roleFilter}
						class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
					>
						<option value="all">All Roles</option>
						<option value={UserRole.ADMIN}>Admin</option>
						<option value={UserRole.PM}>PM</option>
						<option value={UserRole.RO}>RO</option>
					</select>
				</div>

				<!-- Refresh Button -->
				<button
					onclick={handleRefresh}
					class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
				>
					🔄 Refresh
				</button>

				<!-- Add User Button -->
				<button
					onclick={() => (showAddModal = true)}
					class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
				>
					+ Add User
				</button>
			</div>
		</div>

		<!-- Users Table -->
		{#if loading}
			<div class="bg-white rounded-lg shadow p-16 text-center">
				<div
					class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"
				></div>
				<p class="text-gray-600">Loading users...</p>
			</div>
		{:else if error}
			<div class="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
				<p class="font-semibold">Error</p>
				<p>{error}</p>
			</div>
		{:else if filteredUsers.length === 0}
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
						d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
					/>
				</svg>
				<p class="text-gray-600 mb-2">No users found</p>
				{#if searchQuery || roleFilter !== 'all'}
					<p class="text-sm text-gray-500">Try adjusting your filters</p>
				{/if}
			</div>
		{:else}
			<div class="bg-white rounded-lg shadow overflow-hidden">
				<!-- Desktop Table View -->
				<div class="hidden md:block overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 border-b border-gray-200">
							<tr>
								<th
									class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
								>
									User
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
								>
									Role
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
								>
									Created
								</th>
								<th
									class="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each filteredUsers as user}
								{@const roleBadge = getRoleBadge(user.role)}
								{@const canManage = canManageUser(user)}
								<tr class="hover:bg-gray-50 transition">
									<!-- User Info -->
									<td class="px-6 py-4">
										<div>
											<div class="font-semibold text-gray-900 flex items-center gap-2">
												{user.displayName}
												{#if user.uid === $currentUser?.uid}
													<span
														class="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded"
													>
														You
													</span>
												{/if}
											</div>
											<div class="text-sm text-gray-500">{user.email}</div>
										</div>
									</td>

									<!-- Role -->
									<td class="px-6 py-4">
										<span
											class="inline-block px-3 py-1 text-xs font-semibold rounded-full border {roleBadge.class}"
										>
											{roleBadge.text}
										</span>
									</td>

									<!-- Created -->
									<td class="px-6 py-4 text-sm text-gray-600">
										{formatDate(user.createdAt)}
									</td>

									<!-- Actions -->
									<td class="px-6 py-4">
										{#if canManage}
											<div class="flex items-center justify-end gap-2">
												<button
													onclick={() => openEditModal(user)}
													class="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition"
													title="Edit user"
												>
													Edit
												</button>
												{#if user.uid !== $currentUser?.uid}
													<button
														onclick={() => handleDelete(user)}
														class="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium transition"
														title="Delete user"
													>
														Delete
													</button>
												{/if}
											</div>
										{:else}
											<div class="text-right text-sm text-gray-400">—</div>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Mobile Card View -->
				<div class="md:hidden divide-y divide-gray-200">
					{#each filteredUsers as user}
						{@const roleBadge = getRoleBadge(user.role)}
						{@const canManage = canManageUser(user)}
						<div class="p-4 space-y-3">
							<!-- Header -->
							<div class="flex items-start justify-between">
								<div>
									<div class="font-semibold text-gray-900 flex items-center gap-2">
										{user.displayName}
										{#if user.uid === $currentUser?.uid}
											<span class="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
												You
											</span>
										{/if}
									</div>
									<div class="text-sm text-gray-500">{user.email}</div>
								</div>
								<span
									class="inline-block px-3 py-1 text-xs font-semibold rounded-full border {roleBadge.class}"
								>
									{roleBadge.text}
								</span>
							</div>

							<!-- Details -->
							<div class="text-sm text-gray-600">Created: {formatDate(user.createdAt)}</div>

							<!-- Actions -->
							{#if canManage}
								<div class="flex gap-2 pt-2 border-t border-gray-200">
									<button
										onclick={() => openEditModal(user)}
										class="flex-1 px-3 py-2 text-sm text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition font-medium"
									>
										Edit
									</button>
									{#if user.uid !== $currentUser?.uid}
										<button
											onclick={() => handleDelete(user)}
											class="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition font-medium"
										>
											Delete
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- User count -->
			<div class="mt-6 text-sm text-gray-600 text-center">
				{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
				{#if roleFilter !== 'all' || searchQuery}
					(filtered from {users.length} total)
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Modals -->
<AddUserModal bind:isOpen={showAddModal} onSuccess={handleModalSuccess} />
<EditUserModal
	bind:isOpen={showEditModal}
	user={selectedUser}
	onSuccess={handleModalSuccess}
/>
