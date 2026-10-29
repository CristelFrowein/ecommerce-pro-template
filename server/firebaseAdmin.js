import process from "node:process"

import {
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app"

import { getFirestore } from "firebase-admin/firestore"

export function getAdminDb() {
  const appName = "ecommerce-server"

  let app = getApps().find(
    application => application.name === appName
  )

  if (!app) {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ?.replace(/\\n/g, "\n")

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Faltan credenciales de Firebase en las variables del servidor."
      )
    }

    app = initializeApp(
      {
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      },
      appName
    )
  }

  return getFirestore(app)
}