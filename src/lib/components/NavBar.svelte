<script lang="ts">
	import { page } from '$app/stores';
	import { authStore, currentUser, isPM, isAdmin } from '$lib/stores/auth';

	// Navigation items based on role
	const navItems = $derived([
		{ path: '/production-queue', label: 'Production Queue', roles: ['admin', 'pm', 'ro'] },
		{ path: '/resources', label: 'Resources', roles: ['admin', 'pm', 'ro'] },
		{ path: '/gantt', label: 'Gantt Chart', roles: ['admin', 'pm', 'ro'] },
		{ path: '/resource-config', label: 'Configuration', roles: ['admin', 'pm'] },
		{ path: '/users', label: 'Users', roles: ['admin', 'pm'] }
	]);

	// Filter nav items based on user role
	const visibleNavItems = $derived(
		navItems.filter((item) => $currentUser && item.roles.includes($currentUser.role))
	);

	let showUserMenu = $state(false);

	function toggleUserMenu() {
		showUserMenu = !showUserMenu;
	}

	function closeUserMenu() {
		showUserMenu = false;
	}

	async function handleSignOut() {
		closeUserMenu();
		await authStore.signOut();
	}

	// Close menu when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.user-menu-container')) {
			closeUserMenu();
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<nav class="bg-indigo-600 text-white shadow-lg">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between h-16">
			<!-- Logo/Brand -->
			<div class="flex items-center">
				<a href="/" class="flex items-center gap-3 hover:opacity-80 transition">
					<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
						/>
					</svg>
					<span class="text-xl font-bold">LineStart</span>
				</a>
			</div>

			<!-- Navigation Links -->
			<div class="hidden md:flex items-center space-x-1">
				{#each visibleNavItems as item}
					<a
						href={item.path}
						class="px-4 py-2 rounded-lg font-medium transition {$page.url.pathname === item.path
							? 'bg-indigo-700 text-white'
							: 'text-indigo-100 hover:bg-indigo-500 hover:text-white'}"
					>
						{item.label}
					</a>
				{/each}
			</div>

			<!-- User Menu -->
			<div class="flex items-center">
				<div class="relative user-menu-container">
					<button
						onclick={toggleUserMenu}
						class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-500 transition"
					>
						<div class="w-8 h-8 rounded-full bg-indigo-400 flex items-center justify-center">
							<span class="text-sm font-semibold">
								{$currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}
							</span>
						</div>
						<span class="hidden sm:block text-sm font-medium">
							{$currentUser?.displayName || 'User'}
						</span>
						<svg
							class="w-4 h-4 transition-transform {showUserMenu ? 'rotate-180' : ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{#if showUserMenu}
						<div
							class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-1 z-50 border border-gray-200"
						>
							<div class="px-4 py-3 border-b border-gray-200">
								<p class="text-sm font-semibold text-gray-900">{$currentUser?.displayName}</p>
								<p class="text-xs text-gray-500 mt-1">{$currentUser?.email}</p>
								<p class="text-xs text-indigo-600 mt-1 font-medium">
									{$currentUser?.role === 'admin'
										? 'Administrator'
										: $currentUser?.role === 'pm'
											? 'Production Manager'
											: 'Resource Operator'}
								</p>
							</div>

							<!-- Mobile navigation links -->
							<div class="md:hidden border-b border-gray-200">
								{#each visibleNavItems as item}
									<a
										href={item.path}
										onclick={closeUserMenu}
										class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url
											.pathname === item.path
											? 'bg-indigo-50 text-indigo-700 font-semibold'
											: ''}"
									>
										{item.label}
									</a>
								{/each}
							</div>

							<button
								onclick={handleSignOut}
								class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
							>
								Sign Out
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</nav>
