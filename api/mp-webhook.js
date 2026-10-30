import process from "node:process"

import {
  FieldValue
} from "firebase-admin/firestore"

import {
  getAdminDb
} from "../server/firebaseAdmin.js"

import {
  reconcilePayment,
  verifyPaymentSignature
} from "../server/paymentUtils.js"

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store")

  const secret =
    process.env.MP_WEBHOOK_SECRET?.trim()

  const token =
    process.env.MP_ACCESS_TOKEN?.trim()

  const configured = Boolean(
    secret &&
    token &&
    process.env.FIREBASE_PROJECT_ID?.trim() &&
    process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    process.env.FIREBASE_PRIVATE_KEY?.trim()
  )

  if (req.method === "GET") {
    return res.status(configured ? 200 : 503).json({
      ok: configured,
      mode: "test",
      message: configured
        ? "Webhook disponible. Falta probar una compra de prueba completa."
        : "Faltan variables del servidor para el webhook."
    })
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST")

    return res.status(405).json({
      message: "Método no permitido."
    })
  }

  if (!configured) {
    return res.status(503).json({
      message: "Webhook sin configurar."
    })
  }

  try {
    const url = new URL(
      req.url,
      "https://webhook.invalid"
    )

    const id = url.searchParams.get("data.id")

    const validSignature = verifyPaymentSignature(
      {
        id,
        signature: req.headers["x-signature"],
        requestId: req.headers["x-request-id"]
      },
      secret
    )

    if (!validSignature) {
      return res.status(401).json({
        message: "Firma no válida."
      })
    }

    let body = req.body

    if (typeof body === "string") {
      try {
        body = JSON.parse(body)
      } catch {
        return res.status(400).json({
          message: "JSON no válido."
        })
      }
    }

    const type =
      url.searchParams.get("type") ||
      body?.type

    if (type !== "payment") {
      return res.status(200).json({
        received: true,
        ignored: true
      })
    }

    // Consultamos el recurso directamente en Mercado Pago.
    // No confiamos en el estado enviado en el aviso.
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: AbortSignal.timeout(12000)
      }
    )

    if (!response.ok) {
      throw new Error(
        `No se pudo consultar el pago: HTTP ${response.status}.`
      )
    }

    const payment = await response.json()

    if (
      String(payment.id) !== id ||
      payment.live_mode !== false
    ) {
      return res.status(400).json({
        message:
          "No corresponde a un pago de prueba válido."
      })
    }

    const orderId = payment.external_reference

    const orderPattern =
      /^mp_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (
      typeof orderId !== "string" ||
      !orderPattern.test(orderId)
    ) {
      return res.status(200).json({
        received: true,
        ignored: true
      })
    }

    const db = getAdminDb()

    const orderRef = db
      .collection("orders")
      .doc(orderId)

    const paymentRef = orderRef
      .collection("payments")
      .doc(id)

    await db.runTransaction(
      async transaction => {
        const orderSnapshot =
          await transaction.get(orderRef)

        if (!orderSnapshot.exists) return

        const order = orderSnapshot.data()

        if (!order.collectorId) {
          throw new Error(
            "El checkout todavía no terminó de guardarse."
          )
        }

        const previous =
          await transaction.get(paymentRef)

        const changes = reconcilePayment(
          orderId,
          order,
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
              FieldValue.serverTimestamp()
          })
        }
      }
    )

    return res.status(200).json({
      received: true
    })
  } catch (error) {
    console.error(
      "Error al procesar notificación de Mercado Pago:",
      error.message
    )

    // Mercado Pago podrá reintentar la notificación.
    return res.status(503).json({
      message:
        "No se pudo procesar la notificación. Reintentar."
    })
  }
}