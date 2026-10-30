import process from "node:process"

import {
  deleteApp,
  getApps
} from "firebase-admin/app"

import {
  getAdminDb
} from "../server/firebaseAdmin.js"

try {
  const orderId = process.argv[2]

  const orderPattern =
    /^mp_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (!orderPattern.test(orderId || "")) {
    throw new Error(
      "Indicá el número de pedido mp_... al ejecutar el comando."
    )
  }

  const token =
    process.env.MP_ACCESS_TOKEN?.trim()

  if (!token) {
    throw new Error(
      "Falta MP_ACCESS_TOKEN en .env.local."
    )
  }

  const snapshot = await getAdminDb()
    .collection("orders")
    .doc(orderId)
    .get()

  if (!snapshot.exists) {
    throw new Error(
      "El pedido no existe en este proyecto de Firebase."
    )
  }

  const order = snapshot.data()

  const params = new URLSearchParams({
    external_reference: orderId,
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
      signal: AbortSignal.timeout(15000)
    }
  )

  if (!response.ok) {
    throw new Error(
      `La consulta a Mercado Pago devolvió HTTP ${response.status}.`
    )
  }

  const data = await response.json()

  if (!Array.isArray(data.results)) {
    throw new Error(
      "Mercado Pago no devolvió una lista válida."
    )
  }

  console.log(
    "Método guardado:",
    order.paymentMethod
  )

  console.log(
    "Modo guardado:",
    order.paymentMode
  )

  console.log(
    "Pagos encontrados:",
    data.results.length
  )

  for (const payment of data.results) {
    const amount = Number(
      payment.transaction_amount
    )

    const total = Number(order.total)

    console.log(
      JSON.stringify(
        {
          estadoMercadoPago: payment.status,

          live_mode:
            payment.live_mode ?? "ausente",

          tipoLiveMode:
            typeof payment.live_mode,

          referenciaCoincide:
            payment.external_reference === orderId,

          monedaEsARS:
            payment.currency_id === "ARS",

          vendedorGuardadoPresente:
            Boolean(order.collectorId),

          vendedorCoincide:
            Boolean(order.collectorId) &&
            String(order.collectorId) ===
              String(payment.collector_id),

          importeCoincide:
            Number.isFinite(amount) &&
            Number.isFinite(total) &&
            amount > 0 &&
            Math.abs(amount - total) <= 0.000001,

          identificadorValido:
            /^\d{1,30}$/.test(
              String(payment.id || "")
            )
        },
        null,
        2
      )
    )
  }

  console.log(
    "Diagnóstico finalizado. No se modificó ningún pedido ni se realizó ningún pago."
  )
} catch (error) {
  console.error(
    "No se pudo completar el diagnóstico:",
    error.message
  )

  process.exitCode = 1
} finally {
  const app = getApps().find(
    application =>
      application.name === "ecommerce-server"
  )

  if (app) {
    await deleteApp(app)
  }
}