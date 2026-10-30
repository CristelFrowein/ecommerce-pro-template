import { getSelections } from "../utils/cartUtils"

const attemptKey = "mp-checkout-attempt"

function paymentItems(cart) {
  return cart
    .map(item => ({
      productId: item.productId,
      price: Number(item.price),
      quantity: item.quantity,
      selectedAttributes: getSelections(
        item.selectedAttributes
      )
    }))
    .sort((a, b) =>
      JSON.stringify([
        a.productId,
        a.selectedAttributes
      ]).localeCompare(
        JSON.stringify([
          b.productId,
          b.selectedAttributes
        ])
      )
    )
}

export function getPaymentCartSignature(cart) {
  return JSON.stringify(paymentItems(cart))
}

function readAttempt() {
  try {
    return JSON.parse(
      sessionStorage.getItem(attemptKey) || "null"
    )
  } catch {
    return null
  }
}

function forgetAttempt(requestId) {
  if (readAttempt()?.requestId === requestId) {
    sessionStorage.removeItem(attemptKey)
  }
}

export async function startDemoCheckout({
  cart,
  customer,
  notes
}) {
  const payload = {
    items: paymentItems(cart),
    customer,
    notes
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify(payload)
    )
  )

  const fingerprint = Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, "0")
  ).join("")

  let attempt = readAttempt()

  if (
    attempt?.fingerprint !== fingerprint ||
    typeof attempt.requestId !== "string"
  ) {
    attempt = {
      fingerprint,
      requestId: crypto.randomUUID()
    }
  }

  const orderId = `mp_${attempt.requestId}`

  try {
    sessionStorage.setItem(
      attemptKey,
      JSON.stringify(attempt)
    )

    sessionStorage.setItem(
      `mp-cart:${orderId}`,
      getPaymentCartSignature(cart)
    )
  } catch {
    throw new Error(
      "No pudimos guardar la referencia del pago en este navegador. Revisá que permita almacenamiento para este sitio."
    )
  }

  const controller = new AbortController()

  const timeout = setTimeout(
    () => controller.abort(),
    30000
  )

  try {
    const response = await fetch(
      "/api/create-checkout",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          requestId: attempt.requestId
        }),
        signal: controller.signal
      }
    )

    const data = await response
      .json()
      .catch(() => null)

    if (!response.ok) {
      // Consultamos el intento antes de permitir otro.
      const statusResponse = await fetch(
        `/api/payment-status?order=${encodeURIComponent(orderId)}`,
        {
          cache: "no-store",
          signal: controller.signal
        }
      )

      const status = await statusResponse
        .json()
        .catch(() => null)

      if (
        statusResponse.ok &&
        status?.mode === "test" &&
        status.orderId === orderId
      ) {
        if (
          status.reviewRequired ||
          (
            status.verified &&
            status.paymentStatus === "approved"
          )
        ) {
          return {
            redirectUrl:
              `/pago/resultado?order=${encodeURIComponent(orderId)}`
          }
        }

        const finishedWithoutPayment =
          status.verified &&
          [
            "rejected",
            "cancelled",
            "refunded",
            "partially_refunded",
            "charged_back",
            "in_mediation"
          ].includes(status.paymentStatus)

        if (
          status.checkoutState === "failed" ||
          finishedWithoutPayment
        ) {
          forgetAttempt(attempt.requestId)
        }
      }

      throw new Error(
        data?.message ||
          "No se pudo iniciar el pago de prueba. Intentá nuevamente."
      )
    }

    if (
      !data ||
      data.mode !== "test" ||
      data.orderId !== orderId ||
      typeof data.checkoutUrl !== "string"
    ) {
      throw new Error(
        "El servidor no devolvió un checkout de prueba válido."
      )
    }

    const url = new URL(data.checkoutUrl)

    const allowedHosts = [
      "www.mercadopago.com.ar",
      "sandbox.mercadopago.com.ar"
    ]

    if (
      url.protocol !== "https:" ||
      !allowedHosts.includes(url.hostname)
    ) {
      throw new Error(
        "El enlace de Mercado Pago no es válido."
      )
    }

    return {
      redirectUrl: url.href
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "La respuesta está tardando. No se abrió un segundo pago. Volvé a presionar para consultar el mismo intento."
      )
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function finishPaidCheckout(
  orderId,
  cart,
  clearCart
) {
  try {
    const key = `mp-cart:${orderId}`
    const saved = sessionStorage.getItem(key)

    if (!saved) return

    // Quitamos la referencia antes de modificar el carrito.
    sessionStorage.removeItem(key)

    forgetAttempt(
      orderId.replace(/^mp_/, "")
    )


    if (
      saved === getPaymentCartSignature(cart)
    ) {
      clearCart()
    }
  } catch {
   //conservamos el carrito si no podemos verificar
  }
}