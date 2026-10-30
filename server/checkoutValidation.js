export function checkoutError(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

function text(value, maximum, required = false) {
  if (value == null && !required) return ""

  if (typeof value !== "string") {
    throw checkoutError("Los datos del pedido no son válidos.")
  }

  const result = value.trim()

  if (
    result.length > maximum ||
    (required && !result)
  ) {
    throw checkoutError("Revisá los datos del pedido.")
  }

  return result
}

export function parseCheckout(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw checkoutError("El pedido no es válido.")
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (
    typeof body.requestId !== "string" ||
    !uuidPattern.test(body.requestId)
  ) {
    throw checkoutError(
      "El identificador del intento no es válido."
    )
  }

  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 50
  ) {
    throw checkoutError(
      "El carrito debe contener entre 1 y 50 variantes."
    )
  }

  const customer = {
    name: text(body.customer?.name, 100, true),
    phone: text(body.customer?.phone, 30, true),
    address: text(body.customer?.address, 250)
  }

  const items = body.items.map(item => {
    const productId = text(item?.productId, 200, true)

    if (
      productId.includes("/") ||
      productId === "." ||
      productId === ".."
    ) {
      throw checkoutError(
        "Un producto tiene un identificador inválido."
      )
    }

    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999
    ) {
      throw checkoutError(
        "Las cantidades deben ser enteros entre 1 y 999."
      )
    }

    if (
      typeof item.price !== "number" ||
      !Number.isFinite(item.price) ||
      item.price < 0
    ) {
      throw checkoutError(
        "Un precio del carrito no es válido."
      )
    }

    const selected = item.selectedAttributes ?? {}

    if (
      typeof selected !== "object" ||
      !selected ||
      Array.isArray(selected) ||
      Object.keys(selected).length > 10
    ) {
      throw checkoutError(
        "Las opciones seleccionadas no son válidas."
      )
    }

    const entries = Object.entries(selected)

    for (const [name, value] of entries) {
      if (
        !name ||
        name.length > 100 ||
        typeof value !== "string" ||
        !value.trim() ||
        value.length > 200
      ) {
        throw checkoutError(
          "Las opciones seleccionadas no son válidas."
        )
      }
    }

    return {
      productId,
      quantity: item.quantity,
      price: item.price,
      selectedAttributes: Object.fromEntries(
        entries.sort(([a], [b]) => a.localeCompare(b))
      )
    }
  })

  return {
    requestId: body.requestId.toLowerCase(),
    customer,
    notes: text(body.notes, 1000),
    items
  }
}

export function buildOrderItems(items, products) {
  const quantities = new Map()
  const variants = new Map()

  for (const item of items) {
    const product = products.get(item.productId)

    if (!product || product.active === false) {
      throw checkoutError(
        "Un producto ya no está disponible.",
        409
      )
    }

    const price = Number(product.price)
    const cents = Math.round(price * 100)

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isSafeInteger(cents) ||
      cents <= 0 ||
      Math.abs(price * 100 - cents) > 0.000001
    ) {
      throw checkoutError(
        `Revisá el precio de "${product.name}": Mercado Pago requiere un importe positivo con hasta dos decimales.`,
        409
      )
    }

    if (item.price !== price) {
      throw checkoutError(
        `El precio de "${product.name}" cambió. Actualizá el carrito.`,
        409
      )
    }

    const attributes = Array.isArray(product.attributes)
      ? product.attributes.filter(
          attribute =>
            attribute?.type === "select" &&
            attribute.name
        )
      : []

    for (const attribute of attributes) {
      const value =
        item.selectedAttributes[attribute.name]

      const missingRequired =
        !value && attribute.required !== false

      const invalidOption =
        value &&
        (
          !Array.isArray(attribute.options) ||
          !attribute.options.includes(value)
        )

      if (missingRequired || invalidOption) {
        throw checkoutError(
          `Revisá las opciones de "${product.name}".`,
          409
        )
      }
    }

    const hasUnknownAttribute = Object.keys(
      item.selectedAttributes
    ).some(
      name =>
        !attributes.some(
          attribute => attribute.name === name
        )
    )

    if (hasUnknownAttribute) {
      throw checkoutError(
        `Las opciones de "${product.name}" cambiaron.`,
        409
      )
    }

    const quantity =
      (quantities.get(item.productId) || 0) +
      item.quantity

    const stock = Number(product.stock)

    if (
      !Number.isSafeInteger(quantity) ||
      !Number.isFinite(stock) ||
      quantity > Math.max(0, Math.floor(stock))
    ) {
      throw checkoutError(
        `Stock insuficiente de "${product.name}" entre todas sus opciones.`,
        409
      )
    }

    quantities.set(item.productId, quantity)

    const cartItemId = JSON.stringify([
      item.productId,
      Object.entries(item.selectedAttributes)
    ])

    const existing = variants.get(cartItemId)

    variants.set(cartItemId, {
      id: item.productId,
      productId: item.productId,
      cartItemId,
      name: String(product.name || "Producto"),
      price,
      quantity:
        item.quantity + (existing?.quantity || 0),
      selectedAttributes: item.selectedAttributes
    })
  }

  const result = [...variants.values()]

  const totalCents = result.reduce(
    (sum, item) =>
      sum +
      Math.round(item.price * 100) * item.quantity,
    0
  )

  if (
    !Number.isSafeInteger(totalCents) ||
    totalCents <= 0
  ) {
    throw checkoutError(
      "El total del pedido no es válido."
    )
  }

  return {
    items: result,
    total: totalCents / 100
  }
}