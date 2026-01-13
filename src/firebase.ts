import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD4qmWFjjfLxM5G9lzeqlk97PGX_ErVK2k",
  authDomain: "mac-dropin.firebaseapp.com",
  projectId: "mac-dropin",
  storageBucket: "mac-dropin.firebasestorage.app",
  messagingSenderId: "840973209516",
  appId: "1:840973209516:web:296d84410f92dde0fa7409",
  measurementId: "G-S360RFV9M2"
};

// Simple check to see if config is valid (not placeholder)
const isConfigValid = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app;
let db: Firestore;
let auth: Auth;

if (isConfigValid) {
    // Initialize Firebase
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    // Fallback if config is missing.
    // NOTE: Application will likely throw errors when trying to access 'db' in services.ts
    console.warn("Firebase Configuration missing. Please update firebase.ts with your project credentials to use the Database (Test or Prod).");
    // @ts-ignore
    db = {} as Firestore; 
    // @ts-ignore
    auth = { 
        currentUser: null, 
        signOut: async () => {},
        onAuthStateChanged: () => () => {} 
    } as Auth;
}

export const googleProvider = new GoogleAuthProvider();
export { db, auth };