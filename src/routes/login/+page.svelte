<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore, isAuthenticated, isAccessDenied, authLoading, authError } from '$lib/stores/auth';
	import { UserRole } from '$lib/types';

	let signingIn = $state(false);
	let errorMessage = $state('');

	// Redirect if already authenticated
	$effect(() => {
		if ($isAuthenticated) {
			const userData = $authStore.userData;
			if (userData) {
				// Route based on role
				if (userData.role === UserRole.ADMIN || userData.role === UserRole.PM) {
					goto('/production-queue');
				} else if (userData.role === UserRole.RO) {
					goto('/resources');
				}
			}
		}
	});

	async function handleSignIn() {
		signingIn = true;
		errorMessage = '';

		try {
			await authStore.signInWithGoogle();
			// Auth state change will handle routing
		} catch (error: any) {
			console.error('Sign-in failed:', error);
			errorMessage = getErrorMessage(error.code);
			signingIn = false;
		}
	}

	function getErrorMessage(code: string): string {
		switch (code) {
			case 'auth/popup-closed-by-user':
				return 'Sign-in cancelled. Please try again.';
			case 'auth/popup-blocked':
				return 'Pop-up blocked. Please allow pop-ups for this site.';
			case 'auth/network-request-failed':
				return 'Network error. Please check your connection.';
			default:
				return 'Sign-in failed. Please try again.';
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
	<div class="max-w-md w-full mx-4">
		<!-- Logo/Title Card -->
		<div class="bg-white rounded-lg shadow-xl p-8 mb-6 text-center">
			<div class="mb-6">
				<h1 class="text-4xl font-bold text-gray-900 mb-2">LineStart</h1>
				<p class="text-gray-600">Production Scheduling System</p>
			</div>

			<!-- Manufacturing icon -->
			<div class="mb-6">
				<svg
					class="w-24 h-24 mx-auto text-indigo-600"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
					/>
				</svg>
			</div>
		</div>

		<!-- Sign In Card -->
		<div class="bg-white rounded-lg shadow-xl p-8">
			{#if $authLoading && !signingIn}
				<!-- Initial auth check loading -->
				<div class="text-center py-8">
					<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
					<p class="text-gray-600">Loading...</p>
				</div>
			{:else if $isAccessDenied}
				<!-- Access Denied Message -->
				<div class="text-center">
					<div class="mb-4">
						<svg
							class="w-16 h-16 mx-auto text-red-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<h2 class="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
					<p class="text-gray-600 mb-6">
						Your account has not been registered in the system. Please contact your administrator to
						request access.
					</p>
					<button
						onclick={() => authStore.signOut()}
						class="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
					>
						Sign Out
					</button>
				</div>
			{:else}
				<!-- Sign In Button -->
				<div class="text-center">
					<h2 class="text-xl font-semibold text-gray-900 mb-6">Sign in to continue</h2>

					<button
						onclick={handleSignIn}
						disabled={signingIn}
						class="w-full bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if signingIn}
							<div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
							<span>Signing in...</span>
						{:else}
							<svg class="w-5 h-5" viewBox="0 0 24 24">
								<path
									fill="#4285F4"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="#34A853"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="#FBBC05"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								/>
								<path
									fill="#EA4335"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								/>
							</svg>
							<span>Sign in with Google</span>
						{/if}
					</button>

					{#if errorMessage || $authError}
						<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
							<p class="text-sm text-red-600">{errorMessage || 'An error occurred. Please try again.'}</p>
						</div>
					{/if}

					<p class="mt-6 text-sm text-gray-500">
						Only authorized users can access this system. If you don't have an account, please contact
						your system administrator.
					</p>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="text-center mt-6 text-gray-600 text-sm">
			<p>&copy; 2026 LineStart. All rights reserved.</p>
		</div>
	</div>
</div>
