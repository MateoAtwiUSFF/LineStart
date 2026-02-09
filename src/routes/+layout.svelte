<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import '../app.css';
	import { initializeAuth, isAuthenticated, isAccessDenied, authLoading } from '$lib/stores/auth';

	// Initialize auth on app startup
	onMount(() => {
		initializeAuth();
	});

	// Route protection
	$effect(() => {
		const pathname = $page.url.pathname;

		// Skip protection for login page
		if (pathname.startsWith('/login')) {
			return;
		}

		// Wait for auth to finish loading
		if ($authLoading) {
			return;
		}

		// If not authenticated and not on login page, redirect to login
		if (!$isAuthenticated && !$isAccessDenied) {
			goto('/login');
		}

		// If access is denied, redirect to login (which shows access denied message)
		if ($isAccessDenied && !pathname.startsWith('/login')) {
			goto('/login');
		}

		// If on root path and authenticated, redirect based on role
		if ($isAuthenticated && pathname === '/') {
			// Will be handled by home page redirect logic
		}
	});
</script>

{#if $authLoading}
	<!-- Global loading screen while auth initializes -->
	<div class="min-h-screen flex items-center justify-center bg-gray-50">
		<div class="text-center">
			<div class="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
			<p class="text-gray-600">Loading LineStart...</p>
		</div>
	</div>
{:else}
	<slot />
{/if}
