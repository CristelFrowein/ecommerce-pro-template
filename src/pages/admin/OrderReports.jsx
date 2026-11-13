import { useEffect, useMemo, useState } from "react"
import { collection, getDocsFromServer, onSnapshot } from "firebase/firestore"
import { FiBarChart2, FiCalendar, FiChevronLeft, FiChevronRight, FiDownload } from "react-icons/fi"

import { storeConfig } from "../../config/storeConfig"
import { db } from "../../services/firebase"
import { buildOrderReport, formatReportTimestamp, ORDER_STATES } from "../../utils/orderReport"
import { downloadOrderReport } from "../../utils/orderReportExcel"
import "./OrderReports.css"

const PERIODS = [
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensual" },
  { key: "year", label: "Anual" }
]

const ALL_STATES = ORDER_STATES.map(state => state.key)
const readOrders = snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))

function amounts(totals) {
  if (!totals.size) return "—"

  return [...totals].map(([currency, amount]) =>
    new Intl.NumberFormat(storeConfig.locale || "es-AR", {
      style: "currency",
      currency
    }).format(amount)
  ).join(" · ")
}

function OrderChart({ report }) {
  const [selection, setSelection] = useState(null)
  const { buckets, states } = report
  const totals = buckets.map(bucket =>
    states.reduce((sum, state) => sum + bucket.counts[state.key], 0)
  )
  const step = Math.max(1, Math.ceil(Math.max(...totals) / 4))
  const peak = step * 4
  const firstWithOrders = totals.findIndex(total => total > 0)
  const active = buckets.find(bucket => bucket.start === selection) ??
    buckets[Math.max(0, firstWithOrders)]

  return (
    <section className="order-report-card" aria-labelledby="order-chart-title">
      <div className="order-report-section-head">
        <h3 id="order-chart-title">Pedidos por período</h3>
        <div className="order-report-legend">
          {states.map(state => (
            <span key={state.key}>
              <i style={{ backgroundColor: state.color }} aria-hidden="true" />
              {state.label}
            </span>
          ))}
        </div>
      </div>

      {report.rows.length > 0 ? (
        <>
          <div className="order-report-plot">
            <div className="order-report-axis" aria-hidden="true">
              {[4, 3, 2, 1, 0].map(tick => (
                <span key={tick}>{tick * step}</span>
              ))}
            </div>

            <div
              className="order-report-chart-scroll"
              role="region"
              aria-label="Gráfico de pedidos"
              tabIndex={0}
            >
              <div className="order-report-chart" style={{ "--report-buckets": buckets.length }}>
                {buckets.map((bucket, index) => (
                  <button
                    type="button"
                    className="order-report-bar"
                    key={bucket.start}
                    onFocus={() => setSelection(bucket.start)}
                    onMouseEnter={() => setSelection(bucket.start)}
                    onClick={() => setSelection(bucket.start)}
                    aria-pressed={bucket.start === active.start}
                    aria-label={`${bucket.label}. ${states.map(
                      state => `${state.label} ${bucket.counts[state.key]}`
                    ).join(", ")}`}
                  >
                    <span className="order-report-bar-track" aria-hidden="true">
                      {totals[index] > 0 && (
                        <span
                          className="order-report-stack"
                          style={{ height: `${100 * totals[index] / peak}%` }}
                        >
                          <span className="order-report-bar-total">{totals[index]}</span>
                          {states.filter(state => bucket.counts[state.key] > 0).map(state => (
                            <span
                              key={state.key}
                              style={{
                                backgroundColor: state.color,
                                flexGrow: bucket.counts[state.key]
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="order-report-bar-label">{bucket.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="order-report-breakdown" aria-live="polite">
            <strong>{active.label}</strong>
            <div className="order-report-legend">
              {states.map(state => (
                <span key={state.key}>
                  {state.label} <b>{active.counts[state.key]}</b>
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="order-report-empty">No hay pedidos para los filtros seleccionados.</p>
      )}
    </section>
  )
}

function BestSellers({ entries, includesCompleted }) {
  return (
    <section className="order-report-card" aria-labelledby="order-ranking-title">
      <div className="order-report-section-head">
        <h3 id="order-ranking-title">Productos más vendidos</h3>
        <p>Unidades en pedidos completados</p>
      </div>

      {entries.length > 0 ? (
        <div className="order-report-ranking">
          <table>
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Unidades</th>
                <th scope="col">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 10).map((entry, index) => (
                <tr key={entry.id ? `id:${entry.id}` : `name:${entry.name}`}>
                  <th scope="row">
                    <div className="order-report-product">
                      <span className="order-report-rank">{index + 1}</span>
                      <span>{entry.name}</span>
                    </div>
                  </th>
                  <td><strong>{entry.units}</strong></td>
                  <td>{entry.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="order-report-note">
          {includesCompleted
            ? "Todavía no hay productos de pedidos completados en este período."
            : "Seleccioná Completados para ver el ranking."}
        </p>
      )}

      {entries.length > 10 && (
        <p className="order-report-note">El Excel incluye los {entries.length} productos del ranking.</p>
      )}
    </section>
  )
}

export default function OrderReports() {
  const [source, setSource] = useState(null)
  const [unit, setUnit] = useState("month")
  const [offset, setOffset] = useState(0)
  const [keys, setKeys] = useState(ALL_STATES)
  const [loadingError, setLoadingError] = useState("")
  const [exportError, setExportError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [exporting, setExporting] = useState(false)
  const currency = storeConfig.currencyCode || "ARS"

  useEffect(() => onSnapshot(collection(db, "orders"), { includeMetadataChanges: true }, snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return
    setSource({ orders: readOrders(snapshot), now: new Date() })
    setLoadingError("")
  }, () => setLoadingError("No se pudieron cargar los pedidos.")), [attempt])

  const report = useMemo(() => source
    ? buildOrderReport(source.orders, unit, offset, keys, source.now, currency)
    : null, [source, unit, offset, keys, currency])

  async function exportExcel() {
    if (exporting || !keys.length) return
    setExportError("")
    setExporting(true)

    try {
      const snapshot = await getDocsFromServer(collection(db, "orders"))
      if (snapshot.metadata.hasPendingWrites) {
        throw new Error("Esperá a que Firebase confirme los cambios de pedidos y volvé a exportar.")
      }

      const latest = { orders: readOrders(snapshot), now: new Date() }
      const exportReport = buildOrderReport(latest.orders, unit, offset, keys, latest.now, currency)
      await downloadOrderReport(exportReport, unit)
      setSource(previous => previous && previous.now > latest.now ? previous : latest)
    } catch (error) {
      setExportError(error.message || "No se pudo exportar el reporte.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="order-report" aria-labelledby="order-report-title">
      <header className="order-report-header">
        <div className="order-report-icon"><FiBarChart2 aria-hidden="true" /></div>
        <div>
          <h2 id="order-report-title">Reportes de pedidos</h2>
          <p>Balance por período y productos más vendidos.</p>
        </div>
        <button
          className="order-report-primary"
          type="button"
          disabled={!report || !keys.length || exporting}
          onClick={exportExcel}
        >
          <FiDownload aria-hidden="true" /> {exporting ? "Exportando…" : "Descargar Excel"}
        </button>
      </header>

      <fieldset className="order-report-controls order-report-card" disabled={exporting}>
        <legend className="order-report-sr-only">Filtros del reporte</legend>
        <div className="order-report-period">
          <label htmlFor="order-report-unit">Período</label>
          <select id="order-report-unit" value={unit} onChange={event => {
            setUnit(event.target.value)
            setOffset(0)
          }}>
            {PERIODS.map(period => (
              <option key={period.key} value={period.key}>{period.label}</option>
            ))}
          </select>

          <div className="order-report-navigation">
            <button
              type="button"
              onClick={() => setOffset(previous => previous + 1)}
              aria-label="Período anterior"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <div className="order-report-period-label" aria-live="polite">
              <strong>{report?.period.name || "Cargando fechas…"}</strong>
              {report && <small>{report.period.label}</small>}
            </div>
            <button
              type="button"
              onClick={() => setOffset(previous => Math.max(0, previous - 1))}
              disabled={!offset}
              aria-label="Período siguiente"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>

        <fieldset className="order-report-states">
          <legend>Estados de pedido</legend>
          {ORDER_STATES.map(state => (
            <label key={state.key} style={{ "--state-color": state.color }}>
              <input
                type="checkbox"
                checked={keys.includes(state.key)}
                onChange={event => {
                  setKeys(previous => event.target.checked
                    ? [...previous, state.key]
                    : previous.filter(key => key !== state.key))
                }}
              />
              <span>{state.label}</span>
            </label>
          ))}
        </fieldset>
      </fieldset>

      {loadingError && (
        <div className="order-report-warning" role="alert">
          {loadingError}{" "}
          <button type="button" onClick={() => {
            setLoadingError("")
            setAttempt(attempt + 1)
          }}>Reintentar</button>
        </div>
      )}
      {exportError && <p className="order-report-warning" role="alert">{exportError}</p>}
      {!report && !loadingError && <p role="status">Cargando pedidos desde Firebase…</p>}

      {report && (
        <div className="order-report-date-note">
          <p><FiCalendar aria-hidden="true" /> Período según la fecha de creación del pedido.</p>
          <p>
            <strong>Consulta</strong>{" "}
            <time dateTime={report.now.toISOString()}>{formatReportTimestamp(report.now)}</time> (Argentina)
          </p>
          {report.undated > 0 && (
            <p>Pedidos sin fecha válida excluidos del período: {report.undated}.</p>
          )}
        </div>
      )}

      {!keys.length && (
        <p className="order-report-note" role="status">Seleccioná al menos un estado para ver el balance.</p>
      )}

      {report && keys.length > 0 && (
        <>
          <div className="order-report-overview">
            <section className="order-report-card" aria-labelledby="order-count-title">
              <h3 id="order-count-title">Pedidos incluidos</h3>
              <p className="order-report-total">{report.rows.length}</p>
              <dl className="order-report-status-metrics">
                {report.states.map(state => (
                  <div key={state.key}>
                    <dt><i style={{ backgroundColor: state.color }} aria-hidden="true" />{state.label}</dt>
                    <dd>{report.counts[state.key]}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="order-report-card" aria-labelledby="order-amount-title">
              <h3 id="order-amount-title">Importes</h3>
              <dl className="order-report-amounts">
                {keys.includes("completed") && (
                  <div><dt>Pedidos completados</dt><dd>{amounts(report.completed)}</dd></div>
                )}
                <div><dt>Mercado Pago verificado</dt><dd>{amounts(report.approved)}</dd></div>
                {report.approvedTest.size > 0 && (
                  <div><dt>Mercado Pago en prueba</dt><dd>{amounts(report.approvedTest)}</dd></div>
                )}
              </dl>
            </section>
          </div>

          <OrderChart key={`${unit}:${offset}`} report={report} />
          <BestSellers entries={report.ranking} includesCompleted={keys.includes("completed")} />
        </>
      )}
    </section>
  )
}