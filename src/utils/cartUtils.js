import { storeConfig } from "../config/storeConfig"

const moneyFormatter = new Intl.NumberFormat(
  storeConfig.locale || "es-AR",
  {
    style: "currency",
    currency: storeConfig.currencyCode || "ARS",

    minimumFractionDigits:
      storeConfig.prices?.minimumFractionDigits ?? 2,

    maximumFractionDigits:
      storeConfig.prices?.maximumFractionDigits ?? 2
  }
)

export function getStock(product) {
  const stock = Number(product?.stock)

  return Number.isFinite(stock)
    ? Math.max(0, Math.floor(stock))
    : 0
}

export function formatMoney(value) {
  const amount = Number(value)

  return moneyFormatter.format(
    Number.isFinite(amount) ? amount : 0
  )
}

export function getSelections(selected = {}) {
  if (
    !selected ||
    typeof selected !== "object" ||
    Array.isArray(selected)
  ) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(selected)
      .filter(
        ([name, value]) =>
          name &&
          typeof value === "string" &&
          value.trim()
      )
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
  )
}

export function getCartKey(
  productId,
  selected = {}
) {
  return JSON.stringify([
    productId,
    Object.entries(getSelections(selected))
  ])
}

export function getSelectableAttributes(product) {
  return Array.isArray(product?.attributes)
    ? product.attributes.filter(
        attribute =>
          attribute?.type === "select" &&
          attribute.name
      )
    : []
}

export function validateSelections(
  product,
  selected = {}
) {
  const selections = getSelections(selected)

  const attributes =
    getSelectableAttributes(product)

  for (const attribute of attributes) {
    const value = selections[attribute.name]

    const options = Array.isArray(attribute.options)
      ? attribute.options
      : []

    if (
      !value &&
      attribute.required !== false
    ) {
      throw new Error(
        `Elegí ${attribute.name}.`
      )
    }

    if (
      value &&
      !options.includes(value)
    ) {
      throw new Error(
        `La opción elegida para ${attribute.name} ya no está disponible.`
      )
    }
  }

  for (const name of Object.keys(selections)) {
    if (
      !attributes.some(
        attribute => attribute.name === name
      )
    ) {
      throw new Error(
        `Las opciones de "${product.name}" cambiaron. Quitalo del carrito y elegilas nuevamente.`
      )
    }
  }

  return selections
}

export function groupQuantities(items) {
  return items.reduce((groups, item) => {
    const id = item.productId || item.id

    if (
      !id ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error(
        "El pedido contiene una cantidad inválida."
      )
    }

    const quantity =
      (groups.get(id) || 0) + item.quantity

    if (!Number.isSafeInteger(quantity)) {
      throw new Error(
        "El pedido contiene una cantidad inválida."
      )
    }

    groups.set(id, quantity)

    return groups
  }, new Map())
}