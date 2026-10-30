import { Buffer } from "node:buffer"
import process from "node:process"

import {
  createHmac,
  timingSafeEqual
} from "node:crypto"

export function isAllowedDemoPayment(payment) {
  // Entorno sandbox.
  if (payment.live_mode === false) {
    return true
  }

  if (payment.live_mode !== true) {
    return false
  }

  // Para cuentas ficticias que operan en infraestructura
  // de producción, exigimos ambos IDs configurados.
  const sellerId =
    process.env.MP_TEST_SELLER_ID?.trim()

  const buyerId =
    process.env.MP_TEST_BUYER_ID?.trim()

  const validId = /^[1-9]\d{0,29}$/

  return Boolean(
    validId.test(sellerId || "") &&
    validId.test(buyerId || "") &&
    sellerId !== buyerId &&
    String(payment.collector_id) === sellerId &&
    String(payment.payer?.id) === buyerId
  )
}

export function verifyPaymentSignature(
  { id, signature, requestId },
  secret
) {
  if (
    !secret ||
    !/^\d{1,30}$/.test(id || "") ||
    typeof signature !== "string" ||
    typeof requestId !== "string" ||
    !requestId ||
    requestId.length > 200
  ) {
    return false
  }

  const parts = Object.fromEntries(
    signature.split(",").map(part => {
      const separator = part.indexOf("=")

      return [
        part.slice(0, separator).trim(),
        part.slice(separator + 1).trim()
      ]
    })
  )

  if (
    !/^\d{1,20}$/.test(parts.ts || "") ||
    !/^[a-f0-9]{64}$/i.test(parts.v1 || "")
  ) {
    return false
  }

  const manifest =
    `id:${id};` +
    `request-id:${requestId};` +
    `ts:${parts.ts};`

  const expected = createHmac("sha256", secret)
    .update(manifest)
    .digest()

  const received = Buffer.from(
    parts.v1,
    "hex"
  )

  return timingSafeEqual(expected, received)
}

export function reconcilePayment(
  orderId,
  order,
  payment,
  previous = null
) {
  const id = String(payment.id || "")
  const amount = Number(payment.transaction_amount)
  const total = Number(order.total)

  const problems = []

  if (order.paymentMethod !== "mercadopago") {
    problems.push(
      "el pedido no tiene Mercado Pago como método"
    )
  }

  if (order.paymentMode !== "test") {
    problems.push(
      "el pedido no está marcado como prueba"
    )
  }

  if (!isAllowedDemoPayment(payment)) {
    problems.push(
      "el entorno o las cuentas no corresponden a las pruebas habilitadas en el servidor"
    )
  }

  if (payment.external_reference !== orderId) {
    problems.push(
      "la referencia externa no coincide con el pedido"
    )
  }

  if (payment.currency_id !== "ARS") {
    problems.push(
      "la moneda del pago no es ARS"
    )
  }

  if (
    !order.collectorId ||
    String(order.collectorId) !==
      String(payment.collector_id)
  ) {
    problems.push(
      "el vendedor no coincide con el guardado en el pedido"
    )
  }

  if (!/^\d{1,30}$/.test(id)) {
    problems.push(
      "el identificador del pago no es válido"
    )
  }

  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(total) ||
    amount <= 0 ||
    Math.abs(amount - total) > 0.000001
  ) {
    problems.push(
      "el importe del pago no coincide con el total del pedido o no es válido"
    )
  }

  if (problems.length) {
    throw new Error(
      `Verificación de pago rechazada: ${problems.join("; ")}.`
    )
  }

  const updatedAtMs = Date.parse(
    payment.date_last_updated
  )

  if (!Number.isFinite(updatedAtMs)) {
    throw new Error(
      "El pago no tiene una fecha de actualización válida."
    )
  }

  if (
    previous &&
    Number(previous.updatedAtMs) >= updatedAtMs
  ) {
    return null
  }

  const knownStatuses = [
    "approved",
    "pending",
    "in_process",
    "authorized",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
    "in_mediation"
  ]

  let status = knownStatuses.includes(payment.status)
    ? payment.status
    : "unknown"

  if (
    status === "approved" &&
    Number(payment.transaction_amount_refunded) > 0
  ) {
    status = "partially_refunded"
  }

  const testEnvironment =
    payment.live_mode === false
      ? "sandbox"
      : "test_accounts"

  const record = {
    id,
    status,
    updatedAtMs,
    amount,
    currency: "ARS",
    mode: "test",
    providerLiveMode: payment.live_mode,
    testEnvironment
  }

  const fundsStatuses = [
    "approved",
    "partially_refunded",
    "refunded",
    "charged_back",
    "in_mediation"
  ]

  if (
    order.approvedPaymentId &&
    order.approvedPaymentId !== id
  ) {
    return {
      record,
      update: fundsStatuses.includes(status)
        ? { paymentReviewRequired: true }
        : null
    }
  }

  const currentUpdatedAtMs =
    Number(order.paymentUpdatedAtMs) || 0

  if (
    !order.approvedPaymentId &&
    updatedAtMs < currentUpdatedAtMs &&
    status !== "approved"
  ) {
    return {
      record,
      update: null
    }
  }

  if (
    order.approvedPaymentId === id &&
    !fundsStatuses.includes(status)
  ) {
    return {
      record,
      update: {
        paymentReviewRequired: true
      }
    }
  }

  const update = {
    paymentId: id,
    paymentStatus: status,
    paymentStatusDetail: String(
      payment.status_detail || ""
    ).slice(0, 150),
    paymentUpdatedAtMs: updatedAtMs,
    paymentVerified: true,
    paymentTestEnvironment: testEnvironment
  }

  if (fundsStatuses.includes(status)) {
    update.approvedPaymentId = id
  }

  if (
    status === "unknown" ||
    (
      order.status === "cancelled" &&
      fundsStatuses.includes(status)
    )
  ) {
    update.paymentReviewRequired = true
  }

  return {
    record,
    update
  }
}