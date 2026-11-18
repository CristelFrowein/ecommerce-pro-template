import { useState } from "react"
import { collection, getDocs, query, where, orderBy, limit, startAfter } from "firebase/firestore"
import { db } from "../../services/firebase"
import { businessDate, fulfillmentLabels } from "../../utils/commerce"
import { formatMoney } from "../../utils/cartUtils"
import "./CommerceAdmin.css"

const localDay = value => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(value)
const daysAgo = days => localDay(new Date(Date.now() - days * 86400000))
const methodName = order => order.paymentMethod === "mercadopago" ? (order.paymentMode === "test" ? "Mercado Pago DEMO" : "Mercado Pago") : "WhatsApp"
const realOrder = order => order.paymentMode !== "test" &&
  (order.paymentMethod !== "mercadopago" || order.paymentMode === "live")
const confirmed = order => realOrder(order) && order.paymentVerified === true && order.paymentStatus === "approved" &&
  order.paymentReviewRequired !== true
const totalFor = orders => orders.reduce((sum, order) => sum + Math.round((Number(order.total) || 0) * 100), 0) / 100
const moneyRow = order => [
  order.id, order.createdAt?.toDate ? localDay(order.createdAt.toDate()) : "", methodName(order),
  fulfillmentLabels[order.fulfillment] || order.status || "pending", order.paymentStatus || "",
  Number(order.subtotal ?? order.total ?? 0), Number(order.discount || 0),
  Number(order.delivery?.cost || 0), Number(order.total || 0)
]

export default function SalesReports() {
  const [from, setFrom] = useState(() => daysAgo(29))
  const [to, setTo] = useState(() => daysAgo(0))
  const [method, setMethod] = useState("all")
  const [status, setStatus] = useState("all")
  const [report, setReport] = useState(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function load(event) {
    event.preventDefault()
    setError("")
    setReport(null)
    if (from > to) return setError("La fecha desde tiene que ser anterior o igual a la fecha hasta.")
    setBusy(true)
    try {
      const constraints = [
        where("createdAt", ">=", new Date(businessDate(from))),
        where("createdAt", "<", new Date(businessDate(to, true))),
        orderBy("createdAt", "desc"), limit(300)
      ]
      const rows = []
      let cursor
      let count
      do {
        const page = await getDocs(query(collection(db, "orders"), ...constraints, ...(cursor ? [startAfter(cursor)] : [])))
        count = page.size
        cursor = page.docs.at(-1)
        rows.push(...page.docs.map(doc => ({ ...doc.data(), id: doc.id })))
      } while (count === 300)
      setReport({ from, to, rows })
    } catch {
      setError("No pudimos cargar los pedidos del período.")
    } finally { setBusy(false) }
  }

  const rows = report?.rows.filter(order =>
    (method === "all" || (method === "whatsapp" ? order.paymentMethod !== "mercadopago" : order.paymentMethod === method)) &&
    (status === "all" || (order.status || "pending") === status)) || []
  const sales = rows.filter(confirmed)
  const received = rows.filter(realOrder)

  async function download() {
    setError("")
    setBusy(true)
    try {
      const { utils, writeFile } = await import("xlsx")
      const file = utils.book_new()
      const header = ["Pedido", "Fecha", "Método", "Estado", "Pago", "Subtotal", "Descuento", "Entrega", "Total"]
      utils.book_append_sheet(file, utils.aoa_to_sheet([
        ["Desde", report.from], ["Hasta", report.to], ["Pedidos reales recibidos", received.length],
        ["Cobros confirmados", sales.length], ["Importe de cobros confirmados (ARS)", totalFor(sales)],
        ["Pedidos demo", rows.length - received.length]
      ]), "Resumen")
      utils.book_append_sheet(file, utils.aoa_to_sheet([header, ...received.map(moneyRow)]), "Pedidos")
      utils.book_append_sheet(file, utils.aoa_to_sheet([header, ...sales.map(moneyRow)]), "Cobros confirmados")
      utils.book_append_sheet(file, utils.aoa_to_sheet([header, ...rows.filter(order => !realOrder(order)).map(moneyRow)]), "Demo")
      writeFile(file, `ventas-${report.from}-${report.to}.xlsx`)
    } catch {
      setError("No pudimos generar el Excel.")
    } finally { setBusy(false) }
  }

  return <section className="commerce-admin">
    <h2>Reportes de ventas</h2>
    <form onSubmit={load}><fieldset disabled={busy}>
      <div className="commerce-admin-grid">
        <label>Desde<input type="date" required value={from} onChange={event => { setFrom(event.target.value); setReport(null) }} /></label>
        <label>Hasta<input type="date" required value={to} onChange={event => { setTo(event.target.value); setReport(null) }} /></label>
        <label>Método<select value={method} onChange={event => setMethod(event.target.value)}>
          <option value="all">Todos</option><option value="whatsapp">WhatsApp</option><option value="mercadopago">Mercado Pago</option>
        </select></label>
        <label>Estado del pedido<select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">Todos</option><option value="pending">Pendientes</option>
          <option value="completed">Entregados</option><option value="cancelled">Cancelados</option>
        </select></label>
      </div>
      <button type="submit">{busy ? "Procesando…" : "Consultar período"}</button>
    </fieldset></form>
    {error && <p role="alert">{error}</p>}
    {report && <>
      <dl className="commerce-admin-grid">
        <div><dt>Pedidos reales recibidos</dt><dd>{received.length}</dd></div>
        <div><dt>Cobros confirmados</dt><dd>{sales.length}</dd></div>
        <div><dt>Total de cobros confirmados</dt><dd>{formatMoney(totalFor(sales))}</dd></div>
        <div><dt>Pedidos demo</dt><dd>{rows.length - received.length}</dd></div>
      </dl>
      <button type="button" disabled={busy} onClick={download}>Descargar Excel</button>
    </>}
  </section>
}
