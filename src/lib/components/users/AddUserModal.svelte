<script lang="ts">
	import { currentUser, isAdmin } from '$lib/stores/auth';
	import { createUser } from '$lib/utils/firestore';
	import { UserRole, type CreateUserInput } from '$lib/types';

	let {
		isOpen = $bindable(),
		onSuccess
	}: {
		isOpen: boolean;
		onSuccess?: () => void;
	} = $props();

	// Form state
	let email = $state('');
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
			// PM can only create RO users
			return [
				{
					value: UserRole.RO,
					label: 'Resource Operator',
					description: 'Execute work on resources'
				}
			];
		}
	});

	// Reset form
	function resetForm() {
		email = '';
		displayName = '';
		role = UserRole.RO;
		error = null;
	}

	// Close modal
	function close() {
		isOpen = false;
		resetForm();
	}

	// Handle form submission
	async function handleSubmit() {
		error = null;

		// Validation
		if (!email.trim()) {
			error = 'Email is required';
			return;
		}
		if (!displayName.trim()) {
			error = 'Display name is required';
			return;
		}

		// Email format validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			error = 'Please enter a valid email address';
			return;
		}

		// Role validation
		if (!$isAdmin && role !== UserRole.RO) {
			error = 'You can only create Resource Operator users';
			return;
		}

		submitting = true;

		try {
			// Note: This creates a Firestore user document, but the user must still sign in with Google
			// The UID would typically be obtained after they sign in for the first time
			// For now, we'll use a placeholder UID that will be replaced on first sign-in
			const placeholderUid = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			const userData: CreateUserInput = {
				email: email.trim(),
				displayName: displayName.trim(),
				role,
				createdBy: $currentUser!.uid,
				modifiedBy: $currentUser!.uid
			};

			await createUser(placeholderUid, userData);

			if (onSuccess) onSuccess();
			close();
		} catch (err: any) {
			console.error('Error creating user:', err);
			error = err.message || 'Failed to create user';
		} finally {
			submitting = false;
		}
	}
</script>

{#if isOpen}
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
				<h2 id="modal-title" class="text-xl font-bold text-gray-900">Add New User</h2>
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

				<!-- Info Message -->
				<div class="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
					<p class="font-semibold mb-1">Pre-Registration</p>
					<p>
						Users must be added here before they can sign in with Google. They will gain access
						after their first sign-in.
					</p>
				</div>

				<!-- Email -->
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
						Email Address <span class="text-red-500">*</span>
					</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						placeholder="user@example.com"
						required
					/>
					<p class="text-xs text-gray-500 mt-1">
						Must match their Google Sign-In email exactly
					</p>
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
					<div class="space-y-2">
						{#each availableRoles as roleOption}
							<label class="flex items-start p-3 border-2 rounded-lg cursor-pointer transition {role ===
							roleOption.value
								? 'border-indigo-600 bg-indigo-50'
								: 'border-gray-300 hover:border-indigo-400'}">
								<input
									type="radio"
									bind:group={role}
									value={roleOption.value}
									class="mt-1 text-indigo-600 focus:ring-indigo-500"
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
						{submitting ? 'Adding...' : 'Add User'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
