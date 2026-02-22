import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHFmDWXrBndIN-e2J11jZnVQXGhkr7P2A",
  authDomain: "u-a-shop.firebaseapp.com",
  projectId: "u-a-shop",
  storageBucket: "u-a-shop.firebasestorage.app",
  messagingSenderId: "642153392447",
  appId: "1:642153392447:web:6822d56b0120c56ef4cb8a"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
