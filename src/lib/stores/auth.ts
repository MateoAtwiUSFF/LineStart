/**
 * Authentication store for LineStart
 * Manages auth state, user data, and role-based access
 */

import { writable, derived, type Readable } from 'svelte/store';
import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '$lib/firebase';
import { getUser } from '$lib/utils/firestore';
import type { User } from '$lib/types';
import { UserRole } from '$lib/types';

// ============================================================================
// STORE TYPES
// ============================================================================

interface AuthState {
	loading: boolean;
	firebaseUser: FirebaseUser | null;
	userData: User | null;
	error: string | null;
	hasCheckedUser: boolean;
}

// ============================================================================
// STORES
// ============================================================================

/**
 * Main auth state store
 */
const createAuthStore = () => {
	const { subscribe, set, update } = writable<AuthState>({
		loading: true,
		firebaseUser: null,
		userData: null,
		error: null,
		hasCheckedUser: false
	});

	return {
		subscribe,
		set,
		update,

		/**
		 * Initialize auth listener
		 */
		init: () => {
			onAuthStateChanged(auth, async (firebaseUser) => {
				if (firebaseUser) {
					// User is signed in, check for user document
					try {
						const userData = await getUser(firebaseUser.uid);

						if (userData) {
							// User exists in database
							update((state) => ({
								...state,
								loading: false,
								firebaseUser,
								userData,
								error: null,
								hasCheckedUser: true
							}));
						} else {
							// User signed in with Google but not pre-registered
							update((state) => ({
								...state,
								loading: false,
								firebaseUser,
								userData: null,
								error: 'access_denied',
								hasCheckedUser: true
							}));
						}
					} catch (error) {
						console.error('Error fetching user data:', error);
						update((state) => ({
							...state,
							loading: false,
							firebaseUser,
							userData: null,
							error: 'fetch_error',
							hasCheckedUser: true
						}));
					}
				} else {
					// User is signed out
					set({
						loading: false,
						firebaseUser: null,
						userData: null,
						error: null,
						hasCheckedUser: true
					});
				}
			});
		},

		/**
		 * Sign in with Google
		 */
		signInWithGoogle: async () => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				await signInWithPopup(auth, googleProvider);
				// onAuthStateChanged will handle the rest
			} catch (error: any) {
				console.error('Sign-in error:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.code || 'sign_in_failed'
				}));
				throw error;
			}
		},

		/**
		 * Sign out
		 */
		signOut: async () => {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				await signOut(auth);
				set({
					loading: false,
					firebaseUser: null,
					userData: null,
					error: null,
					hasCheckedUser: true
				});
			} catch (error: any) {
				console.error('Sign-out error:', error);
				update((state) => ({
					...state,
					loading: false,
					error: error.code || 'sign_out_failed'
				}));
				throw error;
			}
		},

		/**
		 * Refresh user data from Firestore
		 */
		refreshUserData: async () => {
			update((state) => {
				if (!state.firebaseUser) return state;
				return { ...state, loading: true };
			});

			const currentState = await new Promise<AuthState>((resolve) => {
				const unsubscribe = subscribe((state) => {
					unsubscribe();
					resolve(state);
				});
			});

			if (!currentState.firebaseUser) return;

			try {
				const userData = await getUser(currentState.firebaseUser.uid);

				update((state) => ({
					...state,
					loading: false,
					userData,
					error: userData ? null : 'access_denied'
				}));
			} catch (error) {
				console.error('Error refreshing user data:', error);
				update((state) => ({
					...state,
					loading: false,
					error: 'fetch_error'
				}));
			}
		},

		/**
		 * Clear error
		 */
		clearError: () => {
			update((state) => ({ ...state, error: null }));
		}
	};
};

export const authStore = createAuthStore();

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Is user authenticated (has Firebase auth AND user document)
 */
export const isAuthenticated: Readable<boolean> = derived(
	authStore,
	($auth) => $auth.firebaseUser !== null && $auth.userData !== null
);

/**
 * Is user signed in with Google but not pre-registered
 */
export const isAccessDenied: Readable<boolean> = derived(
	authStore,
	($auth) => $auth.firebaseUser !== null && $auth.userData === null && $auth.hasCheckedUser
);

/**
 * Current user data (null if not authenticated)
 */
export const currentUser: Readable<User | null> = derived(authStore, ($auth) => $auth.userData);

/**
 * Current user role (null if not authenticated)
 */
export const currentRole: Readable<UserRole | null> = derived(
	authStore,
	($auth) => $auth.userData?.role || null
);

/**
 * Is loading auth state
 */
export const authLoading: Readable<boolean> = derived(authStore, ($auth) => $auth.loading);

/**
 * Auth error (null if no error)
 */
export const authError: Readable<string | null> = derived(authStore, ($auth) => $auth.error);

/**
 * Is user an admin
 */
export const isAdmin: Readable<boolean> = derived(
	currentRole,
	($role) => $role === UserRole.ADMIN
);

/**
 * Is user a PM (or admin)
 */
export const isPM: Readable<boolean> = derived(
	currentRole,
	($role) => $role === UserRole.PM || $role === UserRole.ADMIN
);

/**
 * Is user an RO
 */
export const isRO: Readable<boolean> = derived(currentRole, ($role) => $role === UserRole.RO);

/**
 * Can user access production queue (admin, pm, or ro in read-only mode)
 */
export const canAccessProductionQueue: Readable<boolean> = derived(
	currentRole,
	($role) => $role !== null
);

/**
 * Can user edit production queue (admin or pm)
 */
export const canEditProductionQueue: Readable<boolean> = derived(isPM, ($isPM) => $isPM);

/**
 * Can user access resource configuration (all roles, pm can edit)
 */
export const canAccessResourceConfig: Readable<boolean> = derived(
	currentRole,
	($role) => $role !== null
);

/**
 * Can user edit resources (admin or pm)
 */
export const canEditResources: Readable<boolean> = derived(isPM, ($isPM) => $isPM);

/**
 * Can user manage users (admin can manage all, pm can manage ROs only)
 */
export const canManageUsers: Readable<boolean> = derived(
	currentRole,
	($role) => $role === UserRole.ADMIN || $role === UserRole.PM
);

/**
 * Can user access Gantt chart (all roles)
 */
export const canAccessGantt: Readable<boolean> = derived(
	currentRole,
	($role) => $role !== null
);

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize auth store (call this once in your app's entry point)
 */
export function initializeAuth() {
	authStore.init();
}
