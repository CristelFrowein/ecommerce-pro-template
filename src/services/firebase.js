import { initializeApp } from "firebase/app"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"



const env = import.meta.env
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig.projectId ? firebaseConfig : {
  projectId: "demo-ecommerce-pro", apiKey: "demo-unconfigured", authDomain: "demo-ecommerce-pro.firebaseapp.com"
})

export const db = getFirestore(app)

export const auth = getAuth(app)

if (env.DEV && env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080)
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
}
