import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"


const firebaseConfig = {
  apiKey: "AIzaSyAqth3uxuUVn-z5-hsKz6wM5uHXDQdHGKk",
  authDomain: "ecommerce-basico.firebaseapp.com",
  projectId: "ecommerce-basico",
  storageBucket: "ecommerce-basico.firebasestorage.app",
  messagingSenderId: "868012448401",
  appId: "1:868012448401:web:a83ab5ef8d140f4650fd30"
};


const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const storage = getStorage(app)