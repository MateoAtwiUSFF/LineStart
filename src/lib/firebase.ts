import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase configuration
const firebaseConfig = {
	apiKey: 'AIzaSyArY46DV1-oMFpvu4gGpC4VIZXPHK3orG8',
	authDomain: 'linestart-86aae.firebaseapp.com',
	projectId: 'linestart-86aae',
	storageBucket: 'linestart-86aae.firebasestorage.app',
	messagingSenderId: '1065609217581',
	appId: '1:1065609217581:web:df9f0a75c39e33e7941aa4',
	measurementId: 'G-SH9T8E4PRT'
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Firebase Cloud Messaging (FCM)
// Only initialize if supported (not available in all browsers/environments)
let messagingInstance: ReturnType<typeof getMessaging> | null = null;

isSupported().then((supported) => {
	if (supported) {
		messagingInstance = getMessaging(app);
	}
});

export const getMessagingInstance = () => messagingInstance;
