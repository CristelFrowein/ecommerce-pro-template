import { availableStock, catalogFields, selectionKey } from "./commerce.js"

export function productCommerceFields(product, attributes, price) {
  const oldPrice = product.oldPrice == null || Number(product.oldPrice) === 0 ? null : Number(product.oldPrice)
  const offerFrom = product.offerFrom || ""
  const offerTo = product.offerTo || ""
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice <= price || price <= 0)) {
    throw new Error("El precio anterior tiene que ser mayor al precio de oferta.")
  }
  if ([offerFrom, offerTo].some(date => date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    throw new Error("Usá fechas con formato AAAA-MM-DD.")
  }
  if ((offerFrom || offerTo) && (!oldPrice || (offerFrom && offerTo && offerFrom > offerTo))) {
    throw new Error("Revisá las fechas y el precio anterior de la oferta.")
  }
  const sku = String(product.sku || "").trim()
  const selectors = attributes.filter(attribute => attribute.type === "select")
  const keys = new Set()
  const ids = new Set()
  const skus = new Set(sku ? [sku.toUpperCase()] : [])
  const variants = (product.variants || []).map(variant => {
    if (!selectors.length || !variant?.id || ids.has(variant.id)) throw new Error("Combinación inválida.")
    const options = Object.fromEntries(selectors.map(attribute => {
      const value = String(variant.options?.[attribute.name] || "").trim()
      if (!value || !attribute.options.includes(value)) throw new Error(`Elegí ${attribute.name} en cada combinación.`)
      return [attribute.name, value]
    }))
    const key = selectionKey(options)
    if (keys.has(key)) throw new Error("Hay combinaciones repetidas.")
    keys.add(key)
    ids.add(variant.id)
    const stock = variant.stock === "" || variant.stock == null ? NaN : Number(variant.stock)
    if (!Number.isSafeInteger(stock) || stock < 0) throw new Error("El stock de la combinación tiene que ser un entero mayor o igual a cero.")
    const variantSku = String(variant.sku || "").trim()
    if (variantSku && skus.has(variantSku.toUpperCase())) throw new Error("Hay códigos SKU repetidos en el producto.")
    if (variantSku) skus.add(variantSku.toUpperCase())
    const image = String(variant.image || "").trim()
    if (image && !/^https?:\/\//i.test(image)) throw new Error("La imagen de la variante necesita una URL http o https.")
    return { id: variant.id, options, stock, sku: variantSku, image, ...(variant.heldStock ? { heldStock: variant.heldStock } : {}) }
  })
  return { sku, oldPrice, offerFrom, offerTo, featured: product.featured === true, variants,
    ...(variants.length ? { stock: availableStock({ variants }) } : {}),
    ...catalogFields({ ...product, price, oldPrice, offerFrom, offerTo, sku, variants }) }
}
