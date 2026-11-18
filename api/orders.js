import { randomBytes } from "node:crypto"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "../server/firebaseAdmin.js"
import { appOrigin, httpError, requestBody, requireAdmin, sendError } from "../server/http.js"
import { inventoryLines, readProducts, writeInventory } from "../server/inventory.js"
import { sweepReservations } from "../server/reservations.js"
import { nextFulfillment } from "../src/utils/commerce.js"

async function track(db, token) {
  if (!/^[a-f0-9]{48}$/.test(token || "")) throw httpError("No encontramos el pedido.", 404)
  const results = await db.collection("orders").where("trackingToken", "==", token).limit(1).get()
  if (results.empty) throw httpError("No encontramos el pedido.", 404)
  const order = results.docs[0].data()
  return {
    fulfillment: order.fulfillment || (order.status === "completed" ? "delivered" : order.status === "cancelled" ? "cancelled" : "received"),
    delivery: order.delivery?.label || "Entrega coordinada con el comercio"
  }
}

async function updateOrder(db, input) {
  if (typeof input.id !== "string" || !/^[\w-]{1,128}$/.test(input.id)) throw httpError("Pedido inválido.")
  const ref = db.collection("orders").doc(input.id)
  return db.runTransaction(async transaction => {
    const order = (await transaction.get(ref)).data()
    if (!order) throw httpError("No encontramos el pedido.", 404)
    const state = order.fulfillment || (order.status === "completed" ? "delivered" : order.status === "cancelled" ? "cancelled" : "received")
    const token = order.trackingToken || randomBytes(24).toString("hex")
    if (input.action === "tracking") {
      if (!order.trackingToken) transaction.update(ref, { trackingToken: token })
      return { token }
    }
    if (input.action === "paid") {
      if (order.paymentMethod === "mercadopago" || order.status === "cancelled") throw httpError("El cobro no se puede confirmar manualmente.", 409)
      if (order.paymentStatus !== "approved") transaction.update(ref, {
        paymentStatus: "approved", paymentVerified: true, paymentConfirmedAt: FieldValue.serverTimestamp()
      })
      return { token }
    }
    if ((order.status || "pending") !== "pending" || state !== input.previous) throw httpError("El estado del pedido cambió. Actualizá la vista.", 409)
    const updatedAt = FieldValue.serverTimestamp()
    if (input.action === "cancel") {
      const verifiedPayment = order.paymentVerified === true &&
        ["approved", "in_process", "pending", "authorized", "partially_refunded", "charged_back", "in_mediation"].includes(order.paymentStatus)
      const needsReview = order.paymentReviewRequired || order.paymentMethod === "mercadopago" &&
        (order.reservation?.state === "held" || verifiedPayment)
      if (needsReview && !input.acknowledged) throw httpError("Confirmá la revisión del pago antes de cancelar.", 409)
      if (order.stockCommittedAt && !order.reservation) {
        const lines = order.stockLines
        if (lines?.length) {
          const products = await readProducts(db, transaction, lines.map(line => line.productId))
          try { writeInventory(db, transaction, products, lines, 1) }
          catch (error) { throw httpError(error.message, 409) }
        }
      }
      transaction.update(ref, { status: "cancelled", fulfillment: "cancelled", cancelledAt: updatedAt, updatedAt,
        ...(needsReview ? { paymentReviewRequired: true } : {}) })
      return { token }
    }
    if (input.action === "resolve-stock") {
      if (order.paymentMethod !== "mercadopago" || !order.paymentReviewRequired || order.paymentStatus !== "approved" ||
        !order.paymentVerified || order.reservation?.state !== "released" || state !== "received" ||
        order.hasMultipleFundedPayments) throw httpError("La situación requiere revisión fuera de este flujo.", 409)
      const items = order.items || []
      const products = await readProducts(db, transaction, items.map(item => item.productId))
      try { writeInventory(db, transaction, products, inventoryLines(items, products), -1) }
      catch (error) { throw httpError(error.message, 409) }
      transaction.update(ref, { reservation: { ...order.reservation, state: "committed" },
        stockCommittedAt: updatedAt, paymentReviewRequired: false, updatedAt })
      return { token }
    }
    if (input.action !== "advance") throw httpError("Acción inválida.")
    const next = nextFulfillment(state, order.delivery?.method)
    if (!next) throw httpError("El pedido ya terminó.", 409)
    const online = order.paymentMethod === "mercadopago"
    if (online && (order.paymentStatus !== "approved" || !order.paymentVerified || order.paymentReviewRequired)) {
      throw httpError("El pago requiere confirmación antes de avanzar.", 409)
    }
    let stockLines
    if (state === "received" && order.reservation?.state !== "committed" && !order.stockCommittedAt) {
      const items = (order.items || []).map(item => ({ ...item, productId: item.productId || item.id }))
      if (!items.length) throw httpError("El pedido no tiene productos válidos.", 409)
      const products = await readProducts(db, transaction, items.map(item => item.productId))
      try { stockLines = inventoryLines(items, products); writeInventory(db, transaction, products, stockLines, -1) }
      catch (error) { throw httpError(error.message, 409) }
    }
    transaction.update(ref, { trackingToken: token, fulfillment: next, updatedAt,
      ...(state === "received" ? { stockCommittedAt: updatedAt } : {}),
      ...(stockLines ? { stockLines } : {}),
      ...(next === "delivered" ? { status: "completed", completedAt: updatedAt } : {}) })
    return { token, fulfillment: next }
  })
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex, nofollow")
  res.setHeader("Referrer-Policy", "no-referrer")
  try {
    if (req.method === "GET") {
      const query = new URL(req.url, "https://local.invalid").searchParams
      return res.json(await track(getAdminDb(), query.get("token")))
    }
    if (req.method !== "POST") return res.status(405).end()
    appOrigin(req)
    await requireAdmin(req)
    const body = requestBody(req)
    const db = getAdminDb()
    if (body.action === "expire") return res.json(await sweepReservations(db, 75))
    return res.json(await updateOrder(db, body))
  } catch (error) {
    return sendError(res, error, "No pudimos consultar o actualizar el pedido.")
  }
}
