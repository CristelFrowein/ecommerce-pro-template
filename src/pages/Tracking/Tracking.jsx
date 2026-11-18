import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { fulfillmentLabels } from "../../utils/commerce"

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
  return <main className="container" style={{ paddingBlock: 40 }}>
    <h1>Seguimiento del pedido</h1>
    {!current && <p role="status">Consultando…</p>}
    {current?.error && <p role="alert">{current.error}</p>}
    {current?.data && <div aria-live="polite">
      <h2>{fulfillmentLabels[current.data.fulfillment] || "Estado pendiente"}</h2>
      <p>{current.data.delivery}</p>
    </div>}
    <Link to="/">Volver a la tienda</Link>
  </main>
}
