import process from "node:process"

import {
  FieldValue
} from "firebase-admin/firestore"

import {
  getAdminDb
} from "../server/firebaseAdmin.js"

import {
  reconcilePayment
} from "../server/paymentUtils.js"

async function syncPayment(db, orderRef) {
  const token =
    process.env.MP_ACCESS_TOKEN?.trim()

  if (!token) {
    throw new Error(
      "Falta MP_ACCESS_TOKEN en el servidor."
    )
  }

  // Limitamos las consultas externas a una cada
  // 15 segundos por pedido.
  const shouldSync = await db.runTransaction(
    async transaction => {
      const snapshot =
        await transaction.get(orderRef)

      if (!snapshot.exists) return false

      const order = snapshot.data()

      if (
        order.paymentMethod !== "mercadopago" ||
        order.paymentMode !== "test" ||
        order.checkoutState !== "ready" ||
        !order.collectorId
      ) {
        return false
      }

      const now = Date.now()

      const lastSync =
        Number(order.paymentLastSyncAtMs) || 0

      if (now - lastSync < 15000) {
        return false
      }

      transaction.update(orderRef, {
        paymentLastSyncAtMs: now
      })

      return true
    }
  )

  if (!shouldSync) return

  const params = new URLSearchParams({
    external_reference: orderRef.id,
    sort: "date_last_updated",
    criteria: "desc",
    limit: "10"
  })

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: AbortSignal.timeout(10000)
    }
  )

  if (!response.ok) {
    throw new Error(
      `Mercado Pago rechazó la consulta de pagos: HTTP ${response.status}.`
    )
  }

  const data = await response.json()

  if (!Array.isArray(data.results)) {
    throw new Error(
      "Mercado Pago no devolvió una lista de pagos válida."
    )
  }

  if (Number(data.paging?.total) > 10) {
    throw new Error(
      "El pedido tiene más de diez pagos. Requiere revisión de sus intentos."
    )
  }

  const payments = data.results
    .filter(
      payment =>
        payment.external_reference === orderRef.id
    )
    .sort(
      (a, b) =>
        Date.parse(a.date_last_updated) -
        Date.parse(b.date_last_updated)
    )

  for (const payment of payments) {
    const paymentId = String(payment.id || "")

    if (!/^\d{1,30}$/.test(paymentId)) {
      throw new Error(
        "Mercado Pago devolvió un identificador de pago inválido."
      )
    }

    const paymentRef = orderRef
      .collection("payments")
      .doc(paymentId)

    await db.runTransaction(
      async transaction => {
        const snapshot =
          await transaction.get(orderRef)

        if (!snapshot.exists) return

        const previous =
          await transaction.get(paymentRef)

        // Reutilizamos las mismas validaciones
        // que utiliza el webhook.
        const changes = reconcilePayment(
          orderRef.id,
          snapshot.data(),
          payment,
          previous.exists
            ? previous.data()
            : null
        )

        if (!changes) return

        transaction.set(paymentRef, {
          ...changes.record,
          verifiedAt:
            FieldValue.serverTimestamp()
        })

        if (changes.update) {
          transaction.update(orderRef, {
            ...changes.update,
            paymentVerifiedAt:
              FieldValue.serverTimestamp(),
            paymentSyncSource:
              "mercadopago-api"
          })
        }
      }
    )
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store")

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")

    return res.status(405).json({
      message: "Método no permitido."
    })
  }

  const url = new URL(
    req.url,
    "https://status.invalid"
  )

  const orderId = url.searchParams.get("order")

  const orderPattern =
    /^mp_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (!orderPattern.test(orderId || "")) {
    return res.status(400).json({
      message:
        "El número de pedido no es válido."
    })
  }

  try {
    const db = getAdminDb()

    const orderRef = db
      .collection("orders")
      .doc(orderId)

    const snapshot = await orderRef.get()

    let order = snapshot.exists
      ? snapshot.data()
      : null

    if (
      !order ||
      order.paymentMethod !== "mercadopago" ||
      order.paymentMode !== "test"
    ) {
      return res.status(404).json({
        message:
          "No encontramos ese pedido de prueba."
      })
    }

    try {
      await syncPayment(db, orderRef)
    } catch (syncError) {
      console.error(
        "Error al sincronizar pago con Mercado Pago:",
        syncError.message
      )

      if (order.paymentVerified !== true) {
        return res.status(503).json({
          message:
            "No pudimos verificar el pago con Mercado Pago. Intentá actualizar el estado nuevamente en unos segundos."
        })
      }
    }

    const updated = await orderRef.get()

    if (!updated.exists) {
      return res.status(404).json({
        message:
          "No encontramos ese pedido de prueba."
      })
    }

    order = updated.data()

    const verified =
      order.paymentVerified === true

    const knownStatuses = [
      "approved",
      "pending",
      "in_process",
      "authorized",
      "rejected",
      "cancelled",
      "refunded",
      "partially_refunded",
      "charged_back",
      "in_mediation",
      "unknown"
    ]

    const paymentStatus =
      verified &&
      knownStatuses.includes(order.paymentStatus)
        ? order.paymentStatus
        : "pending"

    return res.status(200).json({
      orderId,
      mode: "test",
      paymentStatus,
      verified,
      reviewRequired:
        order.paymentReviewRequired === true,
      checkoutState:
        order.checkoutState === "failed"
          ? "failed"
          : "registered"
    })
  } catch (error) {
    console.error(
      "Error al consultar estado del pago:",
      error.code || "sin código"
    )

    return res.status(503).json({
      message:
        "No pudimos consultar el pago. Intentá nuevamente."
    })
  }
}