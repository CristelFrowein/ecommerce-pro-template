export const defaultCommerce = { pickup: true, pickupLabel: "Retiro en local", zones: [], coupons: [] }

export const fulfillmentLabels = {
  received: "Recibido", preparing: "En preparación", ready: "Listo para retirar",
  shipped: "Enviado", delivered: "Entregado", cancelled: "Cancelado"
}

export function nextFulfillment(status = "received", delivery) {
  if (status === "received") return "preparing"
  if (status === "preparing") return delivery === "pickup" ? "ready" : "shipped"
  if (status === "ready" || status === "shipped") return "delivered"
  return null
}

export function searchWords(value) {
  return [...new Set(String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase().match(/[\p{L}\d]+/gu) || [])]
}

export function catalogFields(product, now = Date.now()) {
  const words = searchWords([product.name, product.sku, ...((product.variants || []).map(variant => variant.sku))].join(" "))
  const { price } = offerInfo(product, now)
  const dates = [businessDate(product.offerFrom), businessDate(product.offerTo, true)].filter(date => Number.isFinite(date) && date > now)
  return {
    sortPrice: Number.isFinite(price) ? price : Number.MAX_SAFE_INTEGER,
    nextPriceChangeAtMs: dates.length ? Math.min(...dates) : null,
    active: product.active !== false,
    sortName: searchWords(product.name).join(" "),
    searchPrefixes: [...new Set(words.flatMap(word => Array.from(
      { length: Math.min(word.length, 40) }, (_, index) => word.slice(0, index + 1)
    )))].slice(0, 400)
  }
}

export function sameProductValue(left, right) {
  return JSON.stringify(left ?? null, sortObjectKeys) === JSON.stringify(right ?? null, sortObjectKeys)
}

function sortObjectKeys(_key, value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))
}

export function selectionKey(selection = {}) {
  return JSON.stringify(Object.entries(selection || {}).filter(([, value]) => value).sort(([a], [b]) => a.localeCompare(b)))
}

export function stockNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

export function findVariant(product, selection) {
  return product?.variants?.find(variant => selectionKey(variant.options) === selectionKey(selection))
}

export function availableStock(product, selection) {
  if (!product?.variants?.length) return stockNumber(product?.stock)
  if (selection !== undefined) return stockNumber(findVariant(product, selection)?.stock)
  return product.variants.reduce((sum, variant) => sum + stockNumber(variant.stock), 0)
}

export function businessDate(value, end = false) {
  if (!value) return end ? Infinity : -Infinity
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T00:00:00-03:00`) + (end ? 86400000 : 0)
    : Date.parse(value)
  return timestamp
}

export function offerInfo(product, now = Date.now()) {
  const from = businessDate(product?.offerFrom)
  const to = businessDate(product?.offerTo, true)
  const regular = Number(product?.oldPrice)
  const offer = Number(product?.price)
  const configured = Number.isFinite(regular) && regular > offer && offer > 0
  const active = configured && from <= now && now < to
  return { price: configured && !active ? regular : offer, oldPrice: active ? regular : null,
    discount: active ? Math.round((1 - offer / regular) * 100) : 0 }
}

export function normalizePostalCode(value) {
  const normalized = String(value ?? "").trim().toUpperCase()
  return /^(?:[A-Z])?\d{4}(?:[A-Z]{3})?$/.test(normalized) ? normalized.match(/\d{4}/)[0] : ""
}

export function zoneMatches(zone, postalCode) {
  return String(zone.postalCodes ?? "").split(/[\s,;]+/).some(pattern => {
    if (pattern === "*") return true
    if (/^\d{4}$/.test(pattern)) return pattern === postalCode
    const range = /^(\d{4})-(\d{4})$/.exec(pattern)
    return Boolean(range && postalCode >= range[1] && postalCode <= range[2])
  })
}

export function quoteOrder(settings, input, subtotal, now = Date.now()) {
  const config = { ...defaultCommerce, ...settings }
  const code = String(input.coupon || "").trim().toUpperCase()
  const coupon = code && config.coupons.find(item => item.code === code && item.active !== false &&
    (businessDate(item.startsAt) <= now && businessDate(item.endsAt, true) > now))
  if (code && (!coupon || subtotal < Number(coupon.minimum || 0))) {
    throw new Error("El cupón no está disponible para este pedido.")
  }
  const subtotalCents = Math.round(subtotal * 100)
  const discountCents = coupon ? Math.min(subtotalCents, Math.max(0, Math.round(
    coupon.type === "percent" ? subtotalCents * Number(coupon.amount) / 100 : Number(coupon.amount) * 100
  ))) : 0
  const net = (subtotalCents - discountCents) / 100
  let delivery
  if (input.deliveryMethod === "pickup" && config.pickup) {
    delivery = { method: "pickup", label: config.pickupLabel || defaultCommerce.pickupLabel, cost: 0 }
  } else if (input.deliveryMethod === "shipping") {
    const postalCode = normalizePostalCode(input.postalCode)
    const zone = postalCode && config.zones.find(item => zoneMatches(item, postalCode))
    if (!zone) throw new Error("No encontramos una tarifa para ese código postal.")
    const cost = zone.freeFrom != null && net >= Number(zone.freeFrom) ? 0 : Number(zone.cost)
    if (!Number.isFinite(cost) || cost < 0) throw new Error("La tarifa de envío es inválida.")
    delivery = { method: "shipping", label: zone.label, postalCode, cost: Math.round(cost * 100) / 100 }
  } else {
    throw new Error("Elegí una opción de entrega disponible.")
  }
  return { subtotal: subtotalCents / 100, discount: discountCents / 100, coupon: code, delivery,
    total: (subtotalCents - discountCents + Math.round(delivery.cost * 100)) / 100 }
}
