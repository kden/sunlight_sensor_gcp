/*
 * firebase.ts
 *
 * Firebase configuration and initialization.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID"
};

let app: FirebaseApp;

// This check is important to prevent errors in the test environment
// where we don't want to initialize a real Firebase app.
const isTestEnvironment = process.env.NODE_ENV === 'test';

if (!isTestEnvironment) {
    try {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    } catch (e) {
        console.error("Firebase initialization error:", e);
        // Assign a dummy object in case of error to prevent app crashes on import
        app = {} as FirebaseApp;
    }
} else {
    // For tests, we provide a dummy object. The actual functions will be mocked out in the test files.
    app = {} as FirebaseApp;
}

export { app };
