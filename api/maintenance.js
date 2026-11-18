import process from "node:process"
import { getAdminDb } from "../server/firebaseAdmin.js"
import { updateCatalogPrices } from "../server/catalogMaintenance.js"
import { sweepReservations } from "../server/reservations.js"

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store")
  if (req.method !== "GET") return res.status(405).end()
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(403).end()
  }
  try {
    const db = getAdminDb()
    const [result, indexed] = await Promise.all([sweepReservations(db, 75), updateCatalogPrices(db, 300)])
    return res.status(result.errors ? 503 : 200).json({ ...result, indexed })
  } catch (error) {
    console.error("Error ejecutando mantenimiento", error.message)
    return res.status(503).end()
  }
}
