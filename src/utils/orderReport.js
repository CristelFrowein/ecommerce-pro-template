import { getDate, getStatus } from "./orderFields.js"

export const ORDER_STATES = [
  { key: "completed", label: "Completados", color: "#397659" },
  { key: "pending", label: "Pendientes", color: "#A06A22" },
  { key: "cancelled", label: "Cancelados", color: "#A54E49" }
]

const PAYMENTS = {
  approved: "Aprobado",
  pending: "Pendiente de pago",
  in_process: "En proceso",
  authorized: "Autorizado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
  charged_back: "Contracargo",
  in_mediation: "En revisión",
  not_applicable: "A coordinar"
}

const dates = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
})

const calendar = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
})

const shortDate = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit"
})

const monthTitle = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric"
})

const cutDate = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "numeric",
  month: "long",
  year: "numeric"
})

const cutTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
})

const shortMonth = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC",
  month: "short"
})

const DAY = 86400000
const dateKey = date => date.toISOString().slice(0, 10)

function storeDay(date) {
  const parts = Object.fromEntries(
    dates.formatToParts(date).map(({ type, value }) => [type, value])
  )
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`)
}

export function formatReportTimestamp(date) {
  return `${cutDate.format(date)} · ${cutTime.format(date)} h`
}

export function getReportPeriod(now, unit, offset) {
  const today = storeDay(now)
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()
  let start
  let end

  if (unit === "week") {
    start = new Date(+today - ((today.getUTCDay() + 6) % 7 + offset * 7) * DAY)
    end = new Date(+start + 7 * DAY)
  } else if (unit === "month") {
    start = new Date(Date.UTC(year, month - offset, 1))
    end = new Date(Date.UTC(year, month - offset + 1, 1))
  } else {
    start = new Date(Date.UTC(year - offset, 0, 1))
    end = new Date(Date.UTC(year - offset + 1, 0, 1))
  }

  const last = new Date(Math.min(+end - DAY, +today))
  const buckets = []

  for (let cursor = start; cursor <= last;) {
    const next = unit === "year"
      ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
      : unit === "month"
        ? new Date(+cursor + (7 - (cursor.getUTCDay() + 6) % 7) * DAY)
        : new Date(+cursor + DAY)

    const lastInBucket = new Date(Math.min(+next - DAY, +last))
    const label = unit === "year"
      ? shortMonth.format(cursor)
      : unit === "month" && +cursor !== +lastInBucket
        ? `${shortDate.format(cursor)}–${shortDate.format(lastInBucket)}`
        : shortDate.format(cursor)

    buckets.push({ start: dateKey(cursor), end: dateKey(next), label })
    cursor = next
  }

  const name = unit === "month"
    ? monthTitle.format(start)
    : unit === "year"
      ? String(start.getUTCFullYear())
      : "Semana del " + calendar.format(start)

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    start: dateKey(start),
    end: dateKey(end),
    label: `${calendar.format(start)} al ${calendar.format(last)}`,
    buckets
  }
}

function orderPayment(order) {
  const method = order.paymentMethod || (
    order.preferenceId || order.id.startsWith("mp_") ? "mercadopago" : "whatsapp"
  )

  if (method === "mercadopago") {
    const test = order.paymentTestEnvironment === true || order.paymentMode === "test"
    const verified = order.paymentStatus === "approved" &&
      /^\d{1,30}$/.test(String(order.paymentId ?? ""))

    return {
      method: test ? "Mercado Pago (prueba)" : "Mercado Pago",
      label: verified
        ? "Aprobado y verificado"
        : order.paymentStatus === "approved"
          ? "Aprobación incompleta"
          : PAYMENTS[order.paymentStatus] || "Estado desconocido",
      approved: verified && !order.paymentReviewRequired,
      test
    }
  }

  return {
    method: method === "whatsapp" ? "WhatsApp" : method,
    label: PAYMENTS[order.paymentStatus] ||
      (method === "whatsapp" ? "A coordinar" : "Estado desconocido")
  }
}

function addAmount(totals, currency, amount) {
  if (amount !== null) {
    totals.set(currency, (totals.get(currency) ?? 0) + amount)
  }
}

export function buildOrderReport(orders, unit, offset, keys, now, defaultCurrency) {
  const period = getReportPeriod(now, unit, offset)
  const states = ORDER_STATES.filter(state => keys.includes(state.key))
  const counts = Object.fromEntries(states.map(state => [state.key, 0]))
  const buckets = period.buckets.map(bucket => ({ ...bucket, counts: { ...counts } }))
  const completed = new Map()
  const approved = new Map()
  const approvedTest = new Map()
  const rank = new Map()
  const rows = []
  let undated = 0

  for (const order of orders) {
    const state = getStatus(order)
    if (!keys.includes(state)) continue

    const created = getDate(order.createdAt)
    if (!created) {
      undated += 1
      continue
    }

    const day = dateKey(storeDay(created))
    if (created > now || day < period.start || day >= period.end) continue

    const payment = orderPayment(order)
    const currency = /^[A-Z]{3}$/.test(order.currency) ? order.currency : defaultCurrency
    const rawTotal = order.total
    const parsedTotal = typeof rawTotal === "number" ||
      (typeof rawTotal === "string" && rawTotal.trim())
      ? Number(rawTotal)
      : NaN
    const total = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : null
    const completedAt = getDate(order.completedAt)
    const cancelledAt = getDate(order.cancelledAt)

    counts[state] += 1
    const bucket = buckets.find(group => day >= group.start && day < group.end)
    if (bucket) bucket.counts[state] += 1

    if (payment.approved) {
      addAmount(payment.test ? approvedTest : approved, currency, total)
    }

    if (state === "completed") {
      addAmount(completed, currency, total)
      const productsInOrder = new Set()

      for (const item of Array.isArray(order.items) ? order.items : []) {
        const name = String(item?.name ?? "").trim()
        const id = String(item?.productId || item?.id || "").trim()
        const units = Number(item?.quantity)
        if ((!id && !name) || !Number.isSafeInteger(units) || units < 1) continue

        const key = id ? `id:${id}` : `name:${name.toLocaleLowerCase("es")}`
        const entry = rank.get(key) ?? { id, name: name || id, units: 0, orders: 0, latest: 0 }
        entry.units += units

        if (!productsInOrder.has(key)) entry.orders += 1
        if (name && +created >= entry.latest) {
          entry.name = name
          entry.latest = +created
        }

        productsInOrder.add(key)
        rank.set(key, entry)
      }
    }

    rows.push({ id: order.id, created, completedAt, cancelledAt, state, payment, currency, total })
  }

  rows.sort((a, b) => b.created - a.created || a.id.localeCompare(b.id))
  const ranking = [...rank.values()].sort(
    (a, b) => b.units - a.units || b.orders - a.orders || a.name.localeCompare(b.name, "es")
  )

  return { period, now, states, counts, buckets, rows, ranking, completed, approved, approvedTest, undated }
}