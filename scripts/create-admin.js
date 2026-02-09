/**
 * Script to create an admin user in Firestore
 *
 * Usage:
 * 1. First sign in to get your UID from Firebase Console > Authentication
 * 2. Run: node scripts/create-admin.js <YOUR_UID> <YOUR_EMAIL> <YOUR_NAME>
 *
 * Example:
 * node scripts/create-admin.js "abc123xyz" "you@example.com" "Your Name"
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
	apiKey: 'AIzaSyArY46DV1-oMFpvu4gGpC4VIZXPHK3orG8',
	authDomain: 'linestart-86aae.firebaseapp.com',
	projectId: 'linestart-86aae',
	storageBucket: 'linestart-86aae.firebasestorage.app',
	messagingSenderId: '1065609217581',
	appId: '1:1065609217581:web:df9f0a75c39e33e7941aa4'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get arguments
const [uid, email, displayName] = process.argv.slice(2);

if (!uid || !email || !displayName) {
	console.error('❌ Usage: node scripts/create-admin.js <UID> <EMAIL> <DISPLAY_NAME>');
	console.error('');
	console.error('Example:');
	console.error('  node scripts/create-admin.js "abc123xyz" "admin@example.com" "Admin User"');
	console.error('');
	console.error('To get your UID:');
	console.error('  1. Sign in to the app (you\'ll see Access Denied)');
	console.error('  2. Go to Firebase Console > Authentication > Users');
	console.error('  3. Copy your UID from the list');
	process.exit(1);
}

async function createAdminUser() {
	try {
		console.log('Creating admin user...');
		console.log('  UID:', uid);
		console.log('  Email:', email);
		console.log('  Display Name:', displayName);
		console.log('');

		await setDoc(doc(db, 'users', uid), {
			uid,
			email,
			displayName,
			role: 'admin',
			createdBy: 'system',
			createdAt: serverTimestamp(),
			modifiedBy: 'system',
			modifiedAt: serverTimestamp()
		});

		console.log('✅ Admin user created successfully!');
		console.log('');
		console.log('You can now:');
		console.log('  1. Refresh the app');
		console.log('  2. Sign in with Google');
		console.log('  3. Access the system as an admin');
		process.exit(0);
	} catch (error) {
		console.error('❌ Error creating user:', error);
		process.exit(1);
	}
}

createAdminUser();
