import {
  getAdminDb
} from "../server/firebaseAdmin.js"

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
      message: "El número de pedido no es válido."
    })
  }

  try {
    const snapshot = await getAdminDb()
      .collection("orders")
      .doc(orderId)
      .get()

    const order = snapshot.exists
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

    // No devolvemos datos personales ni el enlace de pago.
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