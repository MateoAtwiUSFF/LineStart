<script lang="ts">
	import { currentUser, isAdmin } from '$lib/stores/auth';
	import { updateUser } from '$lib/utils/firestore';
	import { UserRole, type User } from '$lib/types';

	let {
		isOpen = $bindable(),
		user,
		onSuccess
	}: {
		isOpen: boolean;
		user: User | null;
		onSuccess?: () => void;
	} = $props();

	// Form state
	let displayName = $state('');
	let role = $state<UserRole>(UserRole.RO);

	// UI state
	let submitting = $state(false);
	let error = $state<string | null>(null);

	// Available roles based on current user
	let availableRoles = $derived.by(() => {
		if ($isAdmin) {
			return [
				{ value: UserRole.ADMIN, label: 'Admin', description: 'Full system access' },
				{
					value: UserRole.PM,
					label: 'Production Manager',
					description: 'Manage jobs, resources, and RO users'
				},
				{
					value: UserRole.RO,
					label: 'Resource Operator',
					description: 'Execute work on resources'
				}
			];
		} else {
			// PM can only manage RO users
			return [
				{
					value: UserRole.RO,
					label: 'Resource Operator',
					description: 'Execute work on resources'
				}
			];
		}
	});

	// Load user data when modal opens
	$effect(() => {
		if (isOpen && user) {
			displayName = user.displayName;
			role = user.role;
			error = null;
		}
	});

	// Close modal
	function close() {
		isOpen = false;
	}

	// Handle form submission
	async function handleSubmit() {
		if (!user || !$currentUser) return;

		error = null;

		// Validation
		if (!displayName.trim()) {
			error = 'Display name is required';
			return;
		}

		// Role validation
		if (!$isAdmin && role !== UserRole.RO) {
			error = 'You can only assign Resource Operator role';
			return;
		}

		// Prevent user from demoting themselves
		if (user.uid === $currentUser.uid && role !== user.role) {
			error = 'You cannot change your own role';
			return;
		}

		submitting = true;

		try {
			await updateUser(
				user.uid,
				{
					displayName: displayName.trim(),
					role
				},
				$currentUser.uid
			);

			if (onSuccess) onSuccess();
			close();
		} catch (err: any) {
			console.error('Error updating user:', err);
			error = err.message || 'Failed to update user';
		} finally {
			submitting = false;
		}
	}
</script>

{#if isOpen && user}
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
				<h2 id="modal-title" class="text-xl font-bold text-gray-900">Edit User</h2>
			</div>

			<!-- Modal Body -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="p-6 space-y-4"
			>
				<!-- Error Message -->
				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
						{error}
					</div>
				{/if}

				<!-- Email (Read-only) -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
					<div class="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600">
						{user.email}
					</div>
					<p class="text-xs text-gray-500 mt-1">Email cannot be changed</p>
				</div>

				<!-- Display Name -->
				<div>
					<label for="display-name" class="block text-sm font-medium text-gray-700 mb-1">
						Display Name <span class="text-red-500">*</span>
					</label>
					<input
						id="display-name"
						type="text"
						bind:value={displayName}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						placeholder="John Doe"
						required
					/>
				</div>

				<!-- Role -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Role <span class="text-red-500">*</span>
					</label>
					{#if user.uid === $currentUser?.uid}
						<div class="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm mb-2">
							You cannot change your own role
						</div>
					{/if}
					<div class="space-y-2">
						{#each availableRoles as roleOption}
							<label
								class="flex items-start p-3 border-2 rounded-lg cursor-pointer transition {role ===
								roleOption.value
									? 'border-indigo-600 bg-indigo-50'
									: 'border-gray-300 hover:border-indigo-400'} {user.uid === $currentUser?.uid
									? 'opacity-60 cursor-not-allowed'
									: ''}"
							>
								<input
									type="radio"
									bind:group={role}
									value={roleOption.value}
									disabled={user.uid === $currentUser?.uid}
									class="mt-1 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
								/>
								<div class="ml-3 flex-1">
									<div class="font-medium text-gray-900">{roleOption.label}</div>
									<div class="text-sm text-gray-600">{roleOption.description}</div>
								</div>
							</label>
						{/each}
					</div>
				</div>

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
						class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={submitting}
					>
						{submitting ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
