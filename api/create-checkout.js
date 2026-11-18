import process from "node:process"
import { createHash, randomBytes } from "node:crypto"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "../server/firebaseAdmin.js"
import { buildOrderItems, parseCheckout } from "../server/checkoutValidation.js"
import { createPreference } from "../server/mercadoPago.js"
import { appOrigin, httpError, requestBody, sendError } from "../server/http.js"
import { inventoryLines, readProducts, writeInventory } from "../server/inventory.js"
import { releaseReservation, sweepReservations } from "../server/reservations.js"
import { quoteOrder } from "../src/utils/commerce.js"

function publicOrder(id, order) {
  return { orderId: id, mode: order.paymentMode, checkoutUrl: order.checkoutUrl || null,
    trackingToken: order.trackingToken, items: order.items, delivery: order.delivery,
    subtotal: order.subtotal, discount: order.discount, total: order.total }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store")
  if (req.method === "GET") {
    return res.json({ mode: process.env.PAYMENT_MODE || "off" })
  }
  if (req.method !== "POST") return res.status(405).end()

  let orderRef
  let release
  try {
    const origin = appOrigin(req)
    const body = requestBody(req)
    const db = getAdminDb()
    const settingsRef = db.collection("storeSettings").doc("commerce")
    if (body.action === "quote") {
      const subtotal = Number(body.subtotal)
      const settings = (await settingsRef.get()).data()
      const { pickup, pickupLabel, zones } = settings || {}
      if (!body.deliveryMethod) {
        return res.json({ pickup: pickup !== false, pickupLabel: pickupLabel || "Retiro en local", shipping: Boolean(zones?.length) })
      }
      if (!Number.isFinite(subtotal) || subtotal < 0 || subtotal > 1e12) throw httpError("Subtotal inválido.")
      try { return res.json(quoteOrder(settings, body, subtotal)) }
      catch (error) { throw httpError(error.message) }
    }
    const input = parseCheckout(body)
    const online = input.paymentMethod === "mercadopago"
    if (input.deliveryMethod === "shipping" && !input.customer.address) throw httpError("Completá la dirección de envío.")
    const mode = online ? process.env.PAYMENT_MODE || "off" : "offline"
    if (online && (!["test", "live"].includes(mode) || !process.env.MP_ACCESS_TOKEN || !process.env.MP_WEBHOOK_SECRET)) {
      throw httpError("Mercado Pago todavía no está habilitado.", 503)
    }
    await sweepReservations(db).catch(error => console.error("Error revisando reservas", error.message))
    const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex")
    orderRef = db.collection("orders").doc(`${online ? "mp" : "wa"}_${input.requestId}`)
    const now = Date.now()
    const ip = String(req.headers["x-vercel-forwarded-for"] || req.socket?.remoteAddress || "").slice(0, 200)
    const rateKey = createHash("sha256").update(`${ip}:${Math.floor(now / 900000)}`).digest("hex")
    const rateRef = db.collection("checkoutLimits").doc(rateKey)
    const preferenceExpiresAtMs = now + 20 * 60_000
    const expiresAtMs = preferenceExpiresAtMs + 5 * 60_000

    const result = await db.runTransaction(async transaction => {
      const previous = await transaction.get(orderRef)
      if (previous.exists) {
        const order = previous.data()
        if (order.checkoutFingerprint !== fingerprint) throw httpError("Este intento corresponde a otro pedido.", 409)
        if (!online || (order.checkoutState === "ready" && order.status === "pending" &&
          ["pending", "rejected", "cancelled"].includes(order.paymentStatus) && !order.paymentReviewRequired && order.reservation?.state === "held" &&
          now < order.preferenceExpiresAtMs)) return { order, existing: true }
        throw httpError("El intento ya fue registrado. Consultá su estado.", 409)
      }

      const products = await readProducts(db, transaction, input.items.map(item => item.productId))
      const settings = (await transaction.get(settingsRef)).data()
      const rate = online ? (await transaction.get(rateRef)).data()?.count || 0 : 0
      if (rate >= 12) throw httpError("Hay demasiados intentos de pago. Esperá unos minutos.", 429)
      const validated = buildOrderItems(input.items, products, { allowFree: !online, now })
      let quote
      try { quote = quoteOrder(settings, input, validated.total, now) }
      catch (error) { throw httpError(error.message) }
      if (typeof input.expectedTotal !== "number" || Math.round(input.expectedTotal * 100) !== Math.round(quote.total * 100)) {
        throw httpError("Cambió el total. Volvé a cotizar el pedido.", 409)
      }
      if (online && quote.total <= 0) throw httpError("Para un pedido sin importe, continuá por WhatsApp.")
      const order = {
        items: validated.items, ...quote, customer: input.customer, notes: input.notes,
        status: "pending", fulfillment: "received", paymentMethod: input.paymentMethod,
        paymentStatus: online ? "pending" : "not_applicable", paymentMode: mode,
        currency: "ARS", trackingToken: randomBytes(24).toString("hex"), checkoutFingerprint: fingerprint,
        createdAt: FieldValue.serverTimestamp()
      }
      if (online) {
        const lines = inventoryLines(validated.items, products)
        order.reservation = { state: "held", expiresAtMs, lines, counted: true }
        order.preferenceExpiresAtMs = preferenceExpiresAtMs
        order.checkoutState = "creating"
        writeInventory(db, transaction, products, lines, -1, 1)
        transaction.set(rateRef, { count: rate + 1, expiresAt: new Date(now + 1800000) })
      }
      transaction.create(orderRef, order)
      return { order, existing: false }
    })
    if (!online || result.existing) return res.json(publicOrder(orderRef.id, result.order))

    release = () => releaseReservation(db, orderRef, "failed")
    const preference = await createPreference(orderRef.id, result.order, origin)
    await db.runTransaction(async transaction => {
      const current = (await transaction.get(orderRef)).data()
      if (current?.reservation?.state !== "held" || current.status !== "pending") {
        throw httpError("La reserva ya no está disponible.", 409)
      }
      transaction.update(orderRef, { ...preference, checkoutState: "ready", updatedAt: FieldValue.serverTimestamp() })
    })
    return res.status(201).json(publicOrder(orderRef.id, { ...result.order, ...preference }))
  } catch (error) {
    if (release) await release().catch(failure => console.error("Error liberando reserva", failure.message))
    return sendError(res, error, "No pudimos registrar el pedido.")
  }
}
