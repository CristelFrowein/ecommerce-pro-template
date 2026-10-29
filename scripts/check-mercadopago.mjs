import process from "node:process"
import { randomUUID } from "node:crypto"

const accessToken = process.env.MP_ACCESS_TOKEN?.trim()

async function checkMercadoPago() {
  if (!accessToken) {
    throw new Error(
      "Falta MP_ACCESS_TOKEN en el archivo .env.local."
    )
  }

  const response = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [
          {
            id: "verificacion-demo",
            title: "Verificación de integración DEMO",
            description: "Preferencia de prueba, sin cobro.",
            quantity: 1,
            currency_id: "ARS",
            unit_price: 100
          }
        ],
        external_reference: `verificacion-${randomUUID()}`
      }),
      signal: AbortSignal.timeout(20000)
    }
  )

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    console.error(
      "Mercado Pago rechazó la solicitud."
    )

    console.error("Estado HTTP:", response.status)

    console.error(
      "Código:",
      typeof data?.error === "string"
        ? data.error
        : "sin código"
    )

    process.exitCode = 1
    return
  }

  if (!data?.id) {
    throw new Error(
      "Mercado Pago no devolvió una preferencia válida."
    )
  }

  console.log("Conexión con Mercado Pago correcta.")
  console.log("Preferencia de prueba creada.")
  console.log("ID:", data.id)
  console.log("No se realizó ningún pago.")
}

try {
  await checkMercadoPago()
} catch (error) {
  if (error.name === "TimeoutError") {
    console.error(
      "Mercado Pago tardó demasiado en responder."
    )
  } else {
    console.error(
      error.message || "No se pudo verificar Mercado Pago."
    )
  }

  process.exitCode = 1
}