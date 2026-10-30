import { useEffect, useState } from "react"

import {
  Link,
  useSearchParams
} from "react-router-dom"

import { useCart } from "../../hooks/useCart"

import {
  finishPaidCheckout
} from "../../services/paymentService"

import "./PaymentResult.css"

const messages = {
  approved: [
    "Pago de prueba aprobado",
    "Mercado Pago confirmó el pago ficticio. El comercio continuará con la preparación del pedido."
  ],
  pending: [
    "Tu pago está pendiente",
    "Mercado Pago informó que el pago está pendiente. Esperá su confirmación antes de intentar pagar nuevamente."
  ],
  in_process: [
    "Pago de prueba en proceso",
    "Mercado Pago está procesando el pago. Esperá su confirmación antes de intentar pagar nuevamente."
  ],
  authorized: [
    "Pago de prueba autorizado",
    "El pago fue autorizado, pero todavía no está confirmado como cobrado. No vuelvas a pagar este pedido por ahora."
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
  const { cart, clearCart } = useCart()

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

  useEffect(() => {
    if (
      data?.verified &&
      data.paymentStatus === "approved" &&
      !data.reviewRequired
    ) {
      finishPaidCheckout(
        orderId,
        cart,
        clearCart
      )
    }
  }, [data, orderId, cart, clearCart])

  let tone = "waiting"
  let title = "Consultando pago de prueba…"
  let description =
    "Estamos consultando el estado registrado por el servidor."

  let guidance = ""
  let cartLinkLabel = "Volver al carrito"

  if (!validOrder) {
    tone = "error"
    title = "Falta un pedido válido"
    description =
      "Abrí el enlace de regreso desde el checkout para consultar tu pedido."
  } else if (current?.error) {
    tone = "error"
    title = "No pudimos consultar el pago"
    description = current.error
    guidance =
      "Si ya intentaste pagar, actualizá el estado antes de iniciar otra compra para evitar repetir el pago."
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
  } else if (data && !data.verified) {
    title = "Todavía no hay un pago confirmado"
    description =
      "Tu pedido quedó registrado, pero todavía no tenemos un pago verificado para mostrar."

    guidance =
      "Si saliste de Mercado Pago sin pagar, podés volver al carrito para continuar. Si ya intentaste pagar, actualizá el estado y esperá la confirmación antes de iniciar otro pago."
  } else if (data) {
    const status = data.paymentStatus

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
      cartLinkLabel = "Volver al carrito e intentar nuevamente"
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

        {guidance && (
          <div className="payment-result-guidance">
            <p>{guidance}</p>
          </div>
        )}

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
            {cartLinkLabel}
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