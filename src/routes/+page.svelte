<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { currentUser, isAuthenticated } from '$lib/stores/auth';
	import { UserRole } from '$lib/types';

	// Redirect to appropriate page based on role
	onMount(() => {
		if ($isAuthenticated && $currentUser) {
			if ($currentUser.role === UserRole.ADMIN || $currentUser.role === UserRole.PM) {
				goto('/production-queue');
			} else if ($currentUser.role === UserRole.RO) {
				goto('/resources');
			}
		} else {
			goto('/login');
		}
	});
</script>

<!-- Loading state while redirecting -->
<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="text-center">
		<div class="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
		<p class="text-gray-600">Redirecting...</p>
	</div>
</div>
