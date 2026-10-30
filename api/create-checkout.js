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

export async function createDemoPreference(
  orderId,
  order,
  appUrl
) {
  const token = process.env.MP_ACCESS_TOKEN?.trim()

  const sandbox = token?.startsWith("TEST-")

  let sellerId = null

  if (!sandbox) {
    const seller = await request("/users/me")

    if (
      !Array.isArray(seller.tags) ||
      !seller.tags.includes("test_user")
    ) {
      throw new Error(
        "La demo requiere credenciales de prueba o de un vendedor de prueba."
      )
    }

    sellerId = seller.id
  }

  const returnUrl =
    `${appUrl}/pago/resultado` +
    `?order=${encodeURIComponent(orderId)}`

  const preference = await request(
    "/checkout/preferences",
    {
      method: "POST",
      body: JSON.stringify({
        items: order.items.map(item => ({
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
        })),

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
          demo: true
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
      "No se pudo validar la preferencia de prueba."
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