<script lang="ts">
	import { currentUser } from '$lib/stores/auth';
</script>

<div class="min-h-screen bg-gray-50 p-8">
	<div class="max-w-7xl mx-auto">
		<h1 class="text-3xl font-bold text-gray-900 mb-6">Resources</h1>
		<div class="bg-white rounded-lg shadow p-6">
			<p class="text-gray-600">
				Welcome, {$currentUser?.displayName || 'User'}! This page will be implemented in Task 06.
			</p>
			<p class="mt-4 text-sm text-gray-500">
				Role: {$currentUser?.role}
			</p>
		</div>
	</div>
</div>
