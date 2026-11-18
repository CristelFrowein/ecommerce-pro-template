import process from "node:process"
import { getAuth } from "firebase-admin/auth"
import { getAdminApp } from "./firebaseAdmin.js"

export function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

export function requestBody(req) {
  if (!req.headers["content-type"]?.includes("application/json")) throw httpError("Enviá JSON.", 415)
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error()
    return body
  } catch {
    throw httpError("Solicitud inválida.")
  }
}

export function appOrigin(req) {
  const url = new URL(process.env.APP_URL || "")
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)
  if (url.protocol !== "https:" && !local) throw new Error("Configurá APP_URL.")
  if (req?.headers.origin && req.headers.origin !== url.origin) throw httpError("Origen no permitido.", 403)
  return url.origin
}

export async function requireAdmin(req) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1]
  const claims = token && await getAuth(getAdminApp()).verifyIdToken(token, true).catch(() => null)
  if (claims?.admin !== true) throw httpError("Acceso restringido.", 403)
  return claims
}

export function sendError(res, error, fallback) {
  if (!error.status) console.error(fallback, error.message)
  return res.status(error.status || 503).json({ message: error.status ? error.message : fallback })
}
