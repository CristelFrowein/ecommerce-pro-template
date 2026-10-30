import { Buffer } from "node:buffer"

import {
  createHmac,
  timingSafeEqual
} from "node:crypto"

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

  if (
    order.paymentMethod !== "mercadopago" ||
    order.paymentMode !== "test" ||
    payment.live_mode !== false ||
    payment.external_reference !== orderId ||
    payment.currency_id !== "ARS" ||
    !order.collectorId ||
    String(order.collectorId) !==
      String(payment.collector_id) ||
    !/^\d{1,30}$/.test(id) ||
    !Number.isFinite(amount) ||
    !Number.isFinite(total) ||
    amount <= 0 ||
    Math.abs(amount - total) > 0.000001
  ) {
    throw new Error(
      "El pago no coincide con el pedido de prueba."
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

  // Ignoramos notificaciones repetidas o antiguas.
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

  const record = {
    id,
    status,
    updatedAtMs,
    amount,
    currency: "ARS",
    mode: "test"
  }

  const fundsStatuses = [
    "approved",
    "partially_refunded",
    "refunded",
    "charged_back",
    "in_mediation"
  ]

  // Otro intento no puede sobrescribir un pago aprobado.
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
    paymentVerified: true
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