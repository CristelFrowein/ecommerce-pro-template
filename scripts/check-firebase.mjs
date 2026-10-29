import process from "node:process"

import { deleteApp, getApps } from "firebase-admin/app"
import { getAdminDb } from "../server/firebaseAdmin.js"

try {
  const db = getAdminDb()

  const snapshot = await db
    .collection("products")
    .limit(1)
    .get()

  console.log("Conexión con Firestore correcta.")

  console.log(
    snapshot.empty
      ? "La colección products está vacía."
      : "Lectura de productos correcta."
  )
} catch (error) {
  console.error(
    "No se pudo verificar la conexión con Firestore."
  )

  console.error("Código:", error.code || "sin código")

  process.exitCode = 1
} finally {
  const app = getApps().find(
    application => application.name === "ecommerce-server"
  )

  if (app) {
    await deleteApp(app)
  }
}