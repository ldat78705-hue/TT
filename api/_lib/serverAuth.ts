import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import fs from 'fs';
import path from 'path';

let firebaseConfig: any;
try {
    firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
} catch (e) {
    console.error("Could not load firebase config.");
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const SERVER_EMAIL = 'server_admin@educenter.local';
const SERVER_PASSWORD = process.env.SERVER_DB_PASSWORD || 'EduCenter_Secure_Server_Pwd_2026!';

let isAuthenticated = false;

export async function authenticateServer() {
    if (isAuthenticated && auth.currentUser) return;

    try {
        await signInWithEmailAndPassword(auth, SERVER_EMAIL, SERVER_PASSWORD);
        isAuthenticated = true;
        console.log('Server authenticated to Firebase successfully.');
    } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, SERVER_EMAIL, SERVER_PASSWORD);
                isAuthenticated = true;
                console.log('Server account created and authenticated.');
            } catch (createError) {
                console.error('Failed to create server account:', createError);
                throw createError;
            }
        } else {
            console.error('Server authentication failed:', error);
            throw error;
        }
    }
}
