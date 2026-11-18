import { availableStock, findVariant, stockNumber } from "../src/utils/commerce.js"

export function inventoryLines(items, products) {
  const lines = new Map()
  for (const item of items) {
    const product = products.get(item.productId)
    const variant = findVariant(product, item.selectedAttributes)
    if (product?.variants?.length && !variant) throw new Error("Una combinación ya no está disponible.")
    const key = JSON.stringify([item.productId, variant?.id ?? null])
    const line = lines.get(key) || { productId: item.productId, variantId: variant?.id ?? null, quantity: 0 }
    line.quantity += item.quantity
    if (!product || line.quantity > availableStock(product, item.selectedAttributes)) {
      throw new Error(`Stock insuficiente de "${product?.name || "un producto"}".`)
    }
    lines.set(key, line)
  }
  return [...lines.values()]
}

export function inventoryPatch(product, lines, direction, heldDirection = 0) {
  if (!product) throw new Error("Un producto del pedido ya no existe.")
  const variants = (product.variants || []).map(variant => ({ ...variant }))
  let stock = stockNumber(product.stock)
  let heldUnits = stockNumber(product.heldUnits)
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("Cantidad inválida.")
    heldUnits += heldDirection * line.quantity
    if (line.variantId === null) {
      if (variants.length) throw new Error("Cambió el tipo de inventario del producto.")
      stock += direction * line.quantity
      if (stock < 0) throw new Error(`Stock insuficiente de "${product.name}".`)
    } else {
      const variant = variants.find(item => item.id === line.variantId)
      if (!variant) throw new Error(`Cambió una variante de "${product.name}".`)
      variant.stock = stockNumber(variant.stock) + direction * line.quantity
      if (heldDirection) {
        variant.heldStock = stockNumber(variant.heldStock) + heldDirection * line.quantity
        if (variant.heldStock < 0) throw new Error("El inventario reservado no coincide.")
        if (!variant.heldStock) delete variant.heldStock
      }
      if (variant.stock < 0) throw new Error(`Stock insuficiente de "${product.name}".`)
    }
  }
  if (heldUnits < 0) throw new Error("El inventario reservado no coincide.")
  return variants.length ? { variants, stock: availableStock({ variants }), heldUnits } : { stock, heldUnits }
}

export async function readProducts(db, transaction, productIds) {
  const ids = [...new Set(productIds)]
  const snapshots = await Promise.all(ids.map(id => transaction.get(db.collection("products").doc(id))))
  return new Map(snapshots.map(snapshot => [snapshot.id, snapshot.data()]))
}

export function writeInventory(db, transaction, products, lines, direction, heldDirection = 0) {
  const groups = new Map()
  for (const line of lines) {
    if (!groups.has(line.productId)) groups.set(line.productId, [])
    groups.get(line.productId).push(line)
  }
  const patches = [...groups].map(([id, group]) => [id, inventoryPatch(products.get(id), group, direction, heldDirection)])
  for (const [id, patch] of patches) transaction.update(db.collection("products").doc(id), patch)
}

export async function reservationOnPayment(db, transaction, order, changes) {
  if (!changes || changes.paymentStatus !== "approved" || !order.reservation) return {}
  if (order.reservation.state === "held") {
    const { lines } = order.reservation
    if (order.reservation.counted) {
      const products = await readProducts(db, transaction, lines.map(line => line.productId))
      try { writeInventory(db, transaction, products, lines, 0, -1) }
      catch {
        return { paymentReviewRequired: true, reservation: { ...order.reservation, state: "review" } }
      }
    }
    return { reservation: { ...order.reservation, state: "committed" } }
  }
  if (order.reservation.state === "released" || order.reservation.state === "review") {
    return { paymentReviewRequired: true }
  }
  return {}
}
