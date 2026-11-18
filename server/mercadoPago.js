import process from "node:process"

async function request(path, options = {}) {
  const token = process.env.MP_ACCESS_TOKEN?.trim()

  if (!token) {
    throw new Error(
      "Falta MP_ACCESS_TOKEN en el servidor."
    )
  }

  const response = await fetch(
    `https://api.mercadopago.com${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(15000)
    }
  )

  const data = await response
    .json()
    .catch(() => null)

  if (!response.ok || !data) {
    const error = new Error(
      "No se pudo completar la solicitud a Mercado Pago."
    )

    error.mpStatus = response.status

    throw error
  }

  return data
}

export async function createPreference(
  orderId,
  order,
  appUrl
) {
  const token = process.env.MP_ACCESS_TOKEN?.trim()

  const live = order.paymentMode === "live"
  const sandbox = !live && token?.startsWith("TEST-")

  let sellerId = null

  if (!sandbox) {
    const seller = await request("/users/me")

    if (
      !seller.id || Boolean(seller.tags?.includes("test_user")) === live ||
      (live && !token?.startsWith("APP_USR-"))
    ) {
      throw new Error(
        "Las credenciales de Mercado Pago no corresponden al modo configurado."
      )
    }

    sellerId = seller.id
  }

  const returnUrl =
    `${appUrl}/pago/resultado` +
    `?order=${encodeURIComponent(orderId)}`

  const preferenceItems = order.items.map(item => ({
          id: item.productId,
          title: item.name.slice(0, 200),
          description: Object.entries(
            item.selectedAttributes
          )
            .map(
              ([name, value]) =>
                `${name}: ${value}`
            )
            .join(" · ")
            .slice(0, 250),
          quantity: item.quantity,
          currency_id: "ARS",
          unit_price: item.price
        }))
  if (order.delivery.cost && !order.discount) preferenceItems.push({
    id: "shipping", title: "Envío", quantity: 1, currency_id: "ARS", unit_price: order.delivery.cost
  })

  const preference = await request(
    "/checkout/preferences",
    {
      method: "POST",
      body: JSON.stringify({
        items: order.discount > 0
          ? [{ id: orderId, title: "Pedido con cupón aplicado", quantity: 1, currency_id: "ARS", unit_price: order.total }]
          : preferenceItems,
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(order.preferenceExpiresAtMs).toISOString(),
        payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },

        external_reference: orderId,

        back_urls: {
          success: returnUrl,
          failure: returnUrl,
          pending: returnUrl
        },

        auto_return: "approved",

        notification_url:
          `${appUrl}/api/mp-webhook`,

        metadata: {
          order_id: orderId,
          demo: !live
        }
      })
    }
  )

  if (
    !preference.id ||
    (
      sellerId &&
      String(preference.collector_id) !==
        String(sellerId)
    )
  ) {
    throw new Error(
      "No se pudo validar la preferencia de pago."
    )
  }

  const checkoutUrl = sandbox
    ? preference.sandbox_init_point
    : preference.init_point

  const url = new URL(checkoutUrl)

  const allowedHosts = [
    "www.mercadopago.com.ar",
    "sandbox.mercadopago.com.ar"
  ]

  if (
    url.protocol !== "https:" ||
    !allowedHosts.includes(url.hostname)
  ) {
    throw new Error(
      "Mercado Pago no devolvió una dirección válida para Argentina."
    )
  }

  return {
    preferenceId: preference.id,
    checkoutUrl: url.href,
    collectorId: preference.collector_id
  }
}