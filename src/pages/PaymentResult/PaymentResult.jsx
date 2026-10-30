import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import "./PaymentResult.css"

const messages = {
  approved: [
    "Pago de prueba aprobado",
    "Mercado Pago confirmó el pago ficticio. El comercio continuará con la preparación del pedido."
  ],

  pending: [
    "Estamos esperando la confirmación",
    "El pedido está registrado. Todavía esperamos la confirmación del pago de Mercado Pago."
  ],

  in_process: [
    "Pago de prueba en proceso",
    "Mercado Pago está procesando el pago. Podés volver a consultar su estado."
  ],

  authorized: [
    "Pago de prueba autorizado",
    "El pago fue autorizado, pero todavía no está confirmado como cobrado."
  ],

  rejected: [
    "Pago de prueba rechazado",
    "Este intento no fue aprobado. Podés volver al carrito para intentar nuevamente."
  ],

  cancelled: [
    "Pago de prueba cancelado",
    "Este intento de pago fue cancelado. Podés volver al carrito."
  ],

  refunded: [
    "Pago de prueba reembolsado",
    "Mercado Pago informó que este pago fue reembolsado."
  ],

  partially_refunded: [
    "Pago con reembolso parcial",
    "Mercado Pago informó una devolución parcial del pago de prueba."
  ],

  charged_back: [
    "Pago con contracargo",
    "Este pago de prueba necesita revisión desde la administración."
  ],

  in_mediation: [
    "Pago en revisión",
    "Mercado Pago informó una revisión de este pago de prueba."
  ],

  unknown: [
    "Estado pendiente de revisión",
    "No podemos mostrar este pago como aprobado. Volvé a consultar más tarde."
  ]
}

function PaymentResult() {
  const [searchParams] = useSearchParams()

  const orderId = searchParams.get("order") || ""

  const validOrder =
    /^mp_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      orderId
    )

  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!validOrder) return

    let active = true
    let timer
    let checks = 0

    const controller = new AbortController()

    async function checkPayment() {
      try {
        const response = await fetch(
          `/api/payment-status?order=${encodeURIComponent(orderId)}`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        )

        const data = await response
          .json()
          .catch(() => null)

        if (!response.ok || !data) {
          throw new Error(
            data?.message ||
              "No pudimos consultar el estado del pago."
          )
        }

        if (
          data.mode !== "test" ||
          data.orderId !== orderId
        ) {
          throw new Error(
            "La respuesta del servidor no corresponde a este pedido de prueba."
          )
        }

        if (!active) return

        setResult({
          orderId,
          data,
          error: ""
        })

        checks += 1

        const waiting =
          !data.verified ||
          [
            "pending",
            "in_process",
            "authorized"
          ].includes(data.paymentStatus)

        // Consultamos hasta 15 veces.
        // Después se puede actualizar manualmente.
        if (
          waiting &&
          !data.reviewRequired &&
          data.checkoutState !== "failed" &&
          checks < 15
        ) {
          timer = setTimeout(
            checkPayment,
            3000
          )
        }
      } catch (error) {
        if (
          active &&
          error.name !== "AbortError"
        ) {
          setResult({
            orderId,
            data: null,
            error:
              error.message ||
              "No pudimos consultar el pago."
          })
        }
      }
    }

    checkPayment()

    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [orderId, validOrder, attempt])

  const current =
    result?.orderId === orderId
      ? result
      : null

  const data = current?.data

  let tone = "waiting"
  let title = "Consultando pago de prueba…"
  let description =
    "Estamos consultando el estado registrado por el servidor."

  if (!validOrder) {
    tone = "error"
    title = "Falta un pedido válido"
    description =
      "Abrí el enlace de regreso desde el checkout para consultar tu pedido."
  } else if (current?.error) {
    tone = "error"
    title = "No pudimos consultar el pago"
    description = current.error
  } else if (data?.reviewRequired) {
    title = "Este pago necesita revisión"
    description =
      "El servidor detectó una situación que debe revisar la administración. No vuelvas a pagar este pedido por ahora."
  } else if (
    data?.checkoutState === "failed" &&
    !data.verified
  ) {
    tone = "error"
    title = "No se pudo iniciar el checkout"
    description =
      "Este intento no llegó a preparar el checkout correctamente. Podés volver al carrito."
  } else if (data) {
    const status = data.verified
      ? data.paymentStatus
      : "pending"

    const message =
      messages[status] || messages.unknown

    title = message[0]
    description = message[1]

    if (status === "approved") {
      tone = "success"
    }

    if (
      ["rejected", "cancelled"].includes(status)
    ) {
      tone = "error"
    }
  }

  function retry() {
    setResult(null)
    setAttempt(previous => previous + 1)
  }

  return (
    <section className="payment-result container">
      <div
        className={`payment-result-card payment-result-${tone}`}
      >
        <span className="payment-result-label">
          Mercado Pago · DEMO
        </span>

        <div role="status" aria-live="polite">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        {validOrder && (
          <p className="payment-result-id">
            <strong>Pedido:</strong> {orderId}
          </p>
        )}

        <p className="payment-result-note">
          Estás en una demostración: no se utiliza
          dinero real. La confirmación del pago no
          significa que el pedido ya esté preparado
          o entregado.
        </p>

        <div className="payment-result-actions">
          {validOrder && (
            <button
              type="button"
              onClick={retry}
            >
              Actualizar estado
            </button>
          )}

          <Link to="/cart">
            Volver al carrito
          </Link>

          <Link to="/">
            Ir a la tienda
          </Link>
        </div>
      </div>
    </section>
  )
}

export default PaymentResult