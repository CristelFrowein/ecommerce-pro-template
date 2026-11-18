import { getAuth } from "firebase-admin/auth"
import { getAdminApp } from "../server/firebaseAdmin.js"

const uid = process.argv[2]
if (!uid) throw new Error("Indicá el UID del usuario de Firebase Auth.")
const auth = getAuth(getAdminApp())
const account = await auth.getUser(uid)
await auth.setCustomUserClaims(uid, { ...account.customClaims, admin: true })
console.log("Permiso asignado. Cerrá sesión y volvé a ingresar.")
