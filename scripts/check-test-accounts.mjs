import process from "node:process"

try {
  const orderId = process.argv[2]
  const token = process.env.MP_ACCESS_TOKEN?.trim()

  if (
    !token ||
    !/^mp_[0-9a-f-]{36}$/i.test(orderId || "")
  ) {
    throw new Error(
      "Falta el token local o el número de pedido."
    )
  }

  async function get(path) {
    const response = await fetch(
      `https://api.mercadopago.com${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: AbortSignal.timeout(15000)
      }
    )

    if (!response.ok) {
      throw new Error(
        `Mercado Pago respondió HTTP ${response.status} al consultar ${path.split("?")[0]}.`
      )
    }

    return response.json()
  }

  const seller = await get("/users/me")

  const params = new URLSearchParams({
    external_reference: orderId,
    sort: "date_created",
    criteria: "desc",
    limit: "10"
  })

  const data = await get(
    `/v1/payments/search?${params}`
  )

  const payments = Array.isArray(data.results)
    ? data.results.filter(
        payment =>
          payment.external_reference === orderId
      )
    : []

  console.log(
    "Pagos de este pedido:",
    payments.length
  )

  for (const payment of payments) {
    console.log(
      JSON.stringify(
        {
          vendedorEsCuentaDePrueba:
            Array.isArray(seller.tags) &&
            seller.tags.includes("test_user"),

          vendedorId: String(
            payment.collector_id || "ausente"
          ),

          compradorId: String(
            payment.payer?.id || "ausente"
          ),

          vendedorCoincideConToken:
            String(seller.id) ===
            String(payment.collector_id),

          estado: payment.status,
          live_mode: payment.live_mode
        },
        null,
        2
      )
    )
  }

  console.log(
    "Solo se consultaron datos. No se modificó el pago ni el pedido."
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}