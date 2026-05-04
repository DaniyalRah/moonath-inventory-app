import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBgV5XFyZU_BhrATH5vl6OHsERVCSYL2Os",
  authDomain: "inventory-app-91289.firebaseapp.com",
  projectId: "inventory-app-91289",
  storageBucket: "inventory-app-91289.firebasestorage.app",
  messagingSenderId: "559034909329",
  appId: "1:559034909329:web:d59f1224d31dd9cbc17530"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);