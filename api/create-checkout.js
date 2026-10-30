import process from "node:process"
import { createHash } from "node:crypto"

import {
  FieldValue
} from "firebase-admin/firestore"

import {
  getAdminDb
} from "../server/firebaseAdmin.js"

import {
  buildOrderItems,
  checkoutError,
  parseCheckout
} from "../server/checkoutValidation.js"

import {
  createDemoPreference
} from "../server/mercadoPago.js"

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store")

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST")

    return res.status(405).json({
      message: "Método no permitido."
    })
  }

  const requiredVariables = [
    "APP_URL",
    "MP_ACCESS_TOKEN",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY"
  ]

  const configured = requiredVariables.every(
    name => process.env[name]?.trim()
  )

  if (req.method === "GET") {
    return res.status(configured ? 200 : 503).json({
      ok: configured,
      mode: "test",
      message: configured
        ? "Función disponible. Falta conectar el checkout y las notificaciones."
        : "Faltan variables del servidor."
    })
  }

  let orderRef
  let ownsAttempt = false

  try {
    if (!configured) {
      throw new Error(
        "Faltan variables del servidor."
      )
    }

    const appUrl = new URL(
      process.env.APP_URL.trim()
    )

    if (appUrl.protocol !== "https:") {
      throw new Error(
        "APP_URL debe usar HTTPS."
      )
    }

    if (
      req.headers.origin &&
      req.headers.origin !== appUrl.origin
    ) {
      throw checkoutError(
        "Origen no permitido.",
        403
      )
    }

    if (
      !req.headers["content-type"]?.includes(
        "application/json"
      )
    ) {
      throw checkoutError(
        "La solicitud debe enviarse como JSON.",
        415
      )
    }

    let body = req.body

    if (typeof body === "string") {
      try {
        body = JSON.parse(body)
      } catch {
        throw checkoutError(
          "El JSON no es válido."
        )
      }
    }

    const input = parseCheckout(body)

    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex")

    const db = getAdminDb()

    orderRef = db
      .collection("orders")
      .doc(`mp_${input.requestId}`)

    const result = await db.runTransaction(
      async transaction => {
        const previous =
          await transaction.get(orderRef)

        if (previous.exists) {
          const order = previous.data()

          if (
            order.checkoutFingerprint !==
            fingerprint
          ) {
            throw checkoutError(
              "Este intento corresponde a otro carrito.",
              409
            )
          }

          if (
            order.checkoutState === "ready" &&
            order.status === "pending" &&
            order.paymentStatus === "pending"
          ) {
            return {
              existing: true,
              order
            }
          }

          throw checkoutError(
            "Este intento ya fue registrado. Esperá si está procesándose; si falló, iniciá un intento nuevo.",
            409
          )
        }

        const products = new Map()

        const productIds = new Set(
          input.items.map(item => item.productId)
        )

        // Todas las lecturas van antes de guardar.
        for (const productId of productIds) {
          const snapshot = await transaction.get(
            db.collection("products").doc(productId)
          )

          if (snapshot.exists) {
            products.set(
              productId,
              snapshot.data()
            )
          }
        }

        const validated = buildOrderItems(
          input.items,
          products
        )

        const order = {
          ...validated,
          customer: input.customer,
          notes: input.notes,

          status: "pending",

          paymentMethod: "mercadopago",
          paymentStatus: "pending",
          paymentMode: "test",
          currency: "ARS",

          checkoutState: "creating",
          checkoutFingerprint: fingerprint,

          createdAt:
            FieldValue.serverTimestamp()
        }

        // No reservamos ni descontamos stock.
        transaction.set(orderRef, order)

        return {
          existing: false,
          order
        }
      }
    )

    if (result.existing) {
      return res.status(200).json({
        orderId: orderRef.id,
        checkoutUrl: result.order.checkoutUrl,
        total: result.order.total,
        mode: "test"
      })
    }

    ownsAttempt = true

    const preference =
      await createDemoPreference(
        orderRef.id,
        result.order,
        appUrl.origin
      )

    await orderRef.update({
      ...preference,
      checkoutState: "ready",
      updatedAt: FieldValue.serverTimestamp()
    })

    return res.status(201).json({
      orderId: orderRef.id,
      checkoutUrl: preference.checkoutUrl,
      total: result.order.total,
      mode: "test"
    })
  } catch (error) {
    if (ownsAttempt && orderRef) {
      await orderRef
        .update({
          checkoutState: "failed",
          updatedAt:
            FieldValue.serverTimestamp()
        })
        .catch(() => {})
    }

    console.error(
      "Error de checkout:",
      error.message,
      error.mpStatus || ""
    )

    return res.status(error.status || 502).json({
      message: error.status
        ? error.message
        : "No se pudo iniciar el pago de prueba. Revisá la configuración del servidor e intentá nuevamente."
    })
  }
}