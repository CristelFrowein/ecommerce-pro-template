import { useEffect, useState } from "react"
import { FiArrowLeft, FiCheck, FiPackage } from "react-icons/fi"
import { Link, useParams } from "react-router-dom"
import { fulfillmentLabels } from "../../utils/commerce"
import "./Tracking.css"

const phases = {
  received: 0,
  preparing: 1,
  ready: 2,
  shipped: 2,
  delivered: 3
}

export default function Tracking() {
  const { token } = useParams()
  const [result, setResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/orders?token=${encodeURIComponent(token)}`, {
          cache: "no-store", signal: controller.signal, referrerPolicy: "no-referrer"
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message)
        if (!controller.signal.aborted) setResult({ token, data })
      } catch (error) {
        if (!controller.signal.aborted) setResult({ token, error: error.message || "No pudimos consultar el pedido." })
      }
    }
    load()
    const refresh = setInterval(load, 30000)
    return () => { clearInterval(refresh); controller.abort() }
  }, [token])

  const current = result?.token === token ? result : null
  const fulfillment = current?.data?.fulfillment
  const activePhase = Object.hasOwn(phases, fulfillment) ? phases[fulfillment] : -1
  const handoff = activePhase === 2 ? fulfillmentLabels[fulfillment] : "Envío o retiro"
  const steps = [fulfillmentLabels.received, fulfillmentLabels.preparing, handoff, fulfillmentLabels.delivered]
  const statusLabel = Object.hasOwn(fulfillmentLabels, fulfillment) ? fulfillmentLabels[fulfillment] : "Estado pendiente"

  return (
    <section className="tracking-page container" aria-labelledby="tracking-title">
      <div className="tracking-card">
        <header className="tracking-header">
          <span className="tracking-icon" aria-hidden="true"><FiPackage /></span>
          <h1 id="tracking-title">Seguimiento del pedido</h1>
        </header>

        {!current && <p className="tracking-message" role="status">Consultando el estado del pedido…</p>}
        {current?.error && <p className="tracking-message tracking-message--error" role="alert">{current.error}</p>}
        {current?.data && (
          <>
            <div className="tracking-overview">
              <div className="tracking-current">
                <p>Estado actual</p>
                <h2 className={fulfillment === "cancelled" ? "tracking-status tracking-status--cancelled" : "tracking-status"} aria-live="polite">
                  {statusLabel}
                </h2>
              </div>
              <dl className="tracking-delivery">
                <dt>Entrega</dt>
                <dd>{current.data.delivery}</dd>
              </dl>
            </div>

            {activePhase >= 0 && (
              <ol className="tracking-progress" aria-label="Progreso del pedido" role="list">
                {steps.map((label, index) => (
                  <li key={index} data-complete={index < activePhase} aria-current={index === activePhase ? "step" : undefined}>
                    <span className="tracking-marker" aria-hidden="true">
                      {index < activePhase && <FiCheck />}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        <footer className="tracking-footer">
          <Link className="tracking-return" to="/"><FiArrowLeft aria-hidden="true" /> Volver a la tienda</Link>
        </footer>
      </div>
    </section>
  )
}
