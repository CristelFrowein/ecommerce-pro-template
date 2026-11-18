import { useEffect, useState } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { toast } from "react-toastify"
import { db } from "../../services/firebase"
import { defaultCommerce } from "../../utils/commerce"
import { changeOrder } from "../../services/orderService"
import "./CommerceAdmin.css"

const blankZone = () => ({ id: crypto.randomUUID(), label: "", postalCodes: "", cost: "", freeFrom: "" })
const blankCoupon = () => ({ id: crypto.randomUUID(), code: "", type: "percent", amount: "", minimum: "", startsAt: "", endsAt: "", active: true })

export default function CommerceAdmin({ section }) {
  const [settings, setSettings] = useState(defaultCommerce)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const field = section === "delivery" ? "zones" : "coupons"
  const rows = settings[field]

  useEffect(() => {
    let alive = true
    getDoc(doc(db, "storeSettings", "commerce")).then(snapshot => {
      if (!alive) return
      setSettings({ ...defaultCommerce, ...snapshot.data() })
      setLoaded(true)
    }).catch(() => { if (alive) setError("No pudimos cargar la configuración.") })
    return () => { alive = false }
  }, [])

  function update(id, values) {
    setSettings(previous => ({
      ...previous, [field]: previous[field].map(row => row.id === id ? { ...row, ...values } : row)
    }))
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const normalized = field === "zones" ? rows.map(row => {
        const patterns = row.postalCodes.trim().split(/[\s,;]+/)
        if (!row.label.trim() || patterns.some(pattern => !/^(\*|\d{4}(-\d{4})?)$/.test(pattern) ||
          (pattern.includes("-") && pattern.slice(0, 4) > pattern.slice(5)))) {
          throw new Error("Cada zona necesita un nombre y códigos postales, rangos válidos o *.")
        }
        return { ...row, label: row.label.trim(), postalCodes: patterns.join(", "), cost: Number(row.cost),
          freeFrom: row.freeFrom === "" || row.freeFrom == null ? null : Number(row.freeFrom) }
      }) : rows.map(row => {
        const code = row.code.trim().toUpperCase()
        const amount = Number(row.amount)
        if (!/^[A-Z0-9_-]{2,32}$/.test(code) || !Number.isFinite(amount) || amount <= 0 ||
          (row.type === "percent" && amount > 100) || (row.startsAt && row.endsAt && row.startsAt > row.endsAt)) {
          throw new Error("Revisá el código, el descuento y el período del cupón.")
        }
        return { ...row, code, amount, minimum: Number(row.minimum || 0) }
      })
      if (field === "coupons" && new Set(normalized.map(row => row.code)).size !== normalized.length) {
        throw new Error("Cada cupón tiene que tener un código único.")
      }
      if (field === "zones" && !settings.pickup && !normalized.length) throw new Error("Dejá al menos una opción de entrega.")
      const patch = field === "zones" ? {
        pickup: settings.pickup, pickupLabel: settings.pickupLabel.trim() || defaultCommerce.pickupLabel, zones: normalized
      } : { coupons: normalized }
      await setDoc(doc(db, "storeSettings", "commerce"), patch, { merge: true })
      setSettings(previous => ({ ...previous, ...patch }))
      toast.success("Configuración guardada.")
    } catch (failure) {
      setError(failure.message || "No pudimos guardar los cambios.")
    } finally {
      setBusy(false)
    }
  }

  return <section className="commerce-admin">
    <h2>{field === "zones" ? "Entregas" : "Cupones"}</h2>
    {error && <p role="alert">{error}</p>}
    {!loaded && !error && <p role="status">Cargando configuración…</p>}
    {loaded && <form onSubmit={save}>
      <fieldset disabled={busy}>
        {field === "zones" && <>
          <label className="commerce-admin-check">
            <input type="checkbox" checked={settings.pickup} onChange={event => setSettings({ ...settings, pickup: event.target.checked })} />
            Permitir retiro gratuito
          </label>
          {settings.pickup && <label>Nombre o punto de retiro<input value={settings.pickupLabel}
            maxLength={100} onChange={event => setSettings({ ...settings, pickupLabel: event.target.value })} /></label>}
          <p>Usá códigos de 4 dígitos, rangos como 1821-1828 o * para el resto. Se aplica la primera zona que coincide. El envío gratis se calcula después del cupón.</p>
        </>}
        {rows.map((row, index) => <div className="commerce-admin-row" key={row.id}>
          <h3>{field === "zones" ? "Zona" : "Cupón"} {index + 1}</h3>
          <div className="commerce-admin-grid">
            {field === "zones" ? <>
              <label>Nombre<input value={row.label} maxLength={100} required onChange={event => update(row.id, { label: event.target.value })} /></label>
              <label>Códigos postales<input value={row.postalCodes} maxLength={3000} required onChange={event => update(row.id, { postalCodes: event.target.value })} /></label>
              <label>Tarifa<input type="number" min="0" step="0.01" value={row.cost} required onChange={event => update(row.id, { cost: event.target.value })} /></label>
              <label>Gratis desde<input type="number" min="0" step="0.01" value={row.freeFrom ?? ""} onChange={event => update(row.id, { freeFrom: event.target.value })} /></label>
            </> : <>
              <label>Código<input value={row.code} maxLength={32} required onChange={event => update(row.id, { code: event.target.value })} /></label>
              <label>Tipo<select value={row.type} onChange={event => update(row.id, { type: event.target.value })}>
                <option value="percent">Porcentaje</option><option value="amount">Importe fijo</option>
              </select></label>
              <label>Descuento<input type="number" min="0.01" step="0.01" value={row.amount} required onChange={event => update(row.id, { amount: event.target.value })} /></label>
              <label>Compra mínima<input type="number" min="0" step="0.01" value={row.minimum} onChange={event => update(row.id, { minimum: event.target.value })} /></label>
              <label>Desde<input type="date" value={row.startsAt} onChange={event => update(row.id, { startsAt: event.target.value })} /></label>
              <label>Hasta (inclusive)<input type="date" value={row.endsAt} onChange={event => update(row.id, { endsAt: event.target.value })} /></label>
              <label className="commerce-admin-check"><input type="checkbox" checked={row.active !== false}
                onChange={event => update(row.id, { active: event.target.checked })} /> Cupón activo</label>
            </>}
          </div>
          <button type="button" onClick={() => setSettings({ ...settings, [field]: rows.filter(item => item.id !== row.id) })}>Quitar</button>
        </div>)}
        <div className="commerce-admin-actions">
          <button type="button" onClick={() => setSettings({ ...settings, [field]: [...rows, field === "zones" ? blankZone() : blankCoupon()] })}>
            {field === "zones" ? "Agregar zona" : "Agregar cupón"}
          </button>
          <button type="submit">{busy ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </fieldset>
    </form>}
    {section === "delivery" && <button type="button" disabled={busy} onClick={async () => {
      setBusy(true)
      try {
        const result = await changeOrder({ action: "expire" })
        if (result.errors) toast.warning(`Reservas liberadas: ${result.released}. Fallidas: ${result.errors}.`)
        else toast.success(`Reservas liberadas: ${result.released}.`)
      } catch (failure) { toast.error(failure.message) }
      finally { setBusy(false) }
    }}>Liberar reservas vencidas</button>}
  </section>
}
