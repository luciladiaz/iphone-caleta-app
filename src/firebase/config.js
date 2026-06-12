import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyA-VTMVqBp4ItHan0ndJ4csXgSDx4NxYcI",
  authDomain: "app-iphone-61c85.firebaseapp.com",
  projectId: "app-iphone-61c85",
  storageBucket: "app-iphone-61c85.firebasestorage.app",
  messagingSenderId: "570387512337",
  appId: "1:570387512337:web:a27afa897692c6ea0c45b0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

