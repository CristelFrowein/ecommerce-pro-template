import { test } from "node:test"
import assert from "node:assert/strict"
import { quoteOrder, offerInfo, catalogFields, nextFulfillment } from "../src/utils/commerce.js"
import { parseProductSheet, buildImportPreview, IMPORT_FIELDS } from "../src/utils/productExcelImport.js"
import { inventoryLines, inventoryPatch, reservationOnPayment } from "../server/inventory.js"
import { buildOrderItems } from "../server/checkoutValidation.js"
import { reconcilePayment } from "../server/paymentUtils.js"
import { renderProductPage } from "../api/product-page.js"

const product = {
  id: "remera", name: "Remera básica", sku: "REM-01", category: "ropa", price: 1000, stock: 3, active: true,
  attributes: [{ name: "Talle", type: "select", options: ["M", "L"], required: true }],
  variants: [{ id: "m", options: { Talle: "M" }, stock: 1, sku: "REM-M", image: "" },
    { id: "l", options: { Talle: "L" }, stock: 2, sku: "REM-L", image: "" }]
}
const products = new Map([[product.id, product]])
const item = variant => ({ productId: product.id, selectedAttributes: { Talle: variant }, quantity: 1, price: product.price })

test("cotización con código postal argentino, cupón y envío gratis por subtotal neto", () => {
  const settings = { zones: [
    { label: "Zona sur", postalCodes: "1821-1828", cost: 7000, freeFrom: 50000 },
    { label: "Resto", postalCodes: "*", cost: 12000 }
  ], coupons: [{ code: "PROMO10", type: "percent", amount: 10, minimum: 1000 }] }
  const input = { deliveryMethod: "shipping", postalCode: "B1824ABC", coupon: "promo10" }
  assert.deepEqual(quoteOrder(settings, input, 50000), {
    subtotal: 50000, discount: 5000, coupon: "PROMO10",
    delivery: { method: "shipping", label: "Zona sur", cost: 7000, postalCode: "1824" }, total: 52000
  })
  assert.equal(quoteOrder(settings, input, 60000).delivery.cost, 0)
  assert.throws(() => quoteOrder(settings, { ...input, postalCode: "2" }, 50000), /código postal/)
  assert.throws(() => quoteOrder(settings, input, 100), /cupón/)
  assert.equal(quoteOrder(settings, { deliveryMethod: "pickup" }, 100).total, 100)
})

test("vigencia inclusiva de ofertas en Argentina y búsqueda por SKU de variante", () => {
  const offer = { ...product, price: 800, oldPrice: 1000, offerFrom: "2026-11-18", offerTo: "2026-11-18" }
  assert.equal(offerInfo(offer, Date.parse("2026-11-18T02:59:59Z")).price, 1000)
  assert.equal(offerInfo(offer, Date.parse("2026-11-18T03:00:00Z")).discount, 20)
  assert.equal(offerInfo(offer, Date.parse("2026-11-19T03:00:00Z")).price, 1000)
  assert.ok(catalogFields(product).searchPrefixes.includes("rem"))
  assert.equal(catalogFields(product).sortName, "remera basica")
})

test("el carrito valida variantes por separado y se puede confirmar o liberar el stock reservado", async () => {
  const order = buildOrderItems([item("M"), item("L")], products)
  assert.equal(order.total, 2000)
  assert.throws(() => buildOrderItems([item("M"), item("M")], products), /Stock insuficiente/)
  assert.throws(() => buildOrderItems([{ ...item("L"), price: 2 }], products), /precio/)
  const lines = inventoryLines(order.items, products)
  const held = inventoryPatch(product, lines, -1, 1)
  assert.equal(held.stock, 1)
  assert.equal(held.heldUnits, 2)
  assert.equal(held.variants[0].stock, 0)
  const released = inventoryPatch({ ...product, ...held }, lines, 1, -1)
  assert.deepEqual(released.variants, product.variants)
  assert.equal(released.heldUnits, 0)
  const committed = inventoryPatch({ ...product, ...held }, lines, 0, -1)
  assert.equal(committed.stock, 1)
  assert.equal(committed.heldUnits, 0)
  assert.deepEqual(await reservationOnPayment(null, null, { reservation: { state: "released" } },
    { paymentStatus: "approved" }), { paymentReviewRequired: true })
})

test("conciliación distingue prueba, producción, referencias e importes", () => {
  const base = { id: 1, external_reference: "order", currency_id: "ARS", collector_id: 42,
    transaction_amount: 2000, date_last_updated: "2026-11-18T17:00:00Z", status: "approved" }
  const order = { paymentMethod: "mercadopago", paymentMode: "test", collectorId: 42, total: 2000 }
  const payment = { ...base, live_mode: false }
  const change = reconcilePayment("order", order, payment)
  assert.equal(change.update.paymentStatus, "approved")
  assert.equal(reconcilePayment("order", order, payment, change.record), null)
  assert.throws(() => reconcilePayment("order", order, { ...payment, transaction_amount: 1500 }), /importe/)
  assert.throws(() => reconcilePayment("order", { ...order, paymentMode: "live" }, payment), /entorno/)
  assert.equal(reconcilePayment("order", { ...order, paymentMode: "live" }, { ...payment, live_mode: true }).record.mode, "live")
})

test("importar una exportación encuentra el producto por ID o SKU y conserva variantes", () => {
  const fields = IMPORT_FIELDS.map(([name]) => name)
  const row = values => fields.map(field => values[field] ?? "")
  const catalog = [{ ...product, ...catalogFields(product) }]
  const values = { ...product, name: "Remera nueva", images: "[]", attributes: JSON.stringify(product.attributes),
    variants: JSON.stringify(product.variants), featured: true }
  const preview = variant => buildImportPreview(parseProductSheet([fields, row(variant)]), catalog,
    [{ name: "Ropa", slug: "ropa" }], "ropa", {}, new Map())[0]
  assert.equal(preview(values).existing.id, product.id)
  assert.equal(preview(values).changes.name, "Remera nueva")
  assert.deepEqual(preview(values).product.variants, product.variants)
  assert.equal(preview({ ...values, id: "" }).existing.id, product.id)
  assert.equal(preview({ ...values, id: "otro" }).status, "review")
})

test("seguimiento diferencia retiro y envío, y SEO escapa atributos y JSON", () => {
  assert.equal(nextFulfillment("preparing", "pickup"), "ready")
  assert.equal(nextFulfillment("preparing", "shipping"), "shipped")
  const html = renderProductPage("<head><title>Demo</title></head>", { ...product,
    name: 'Remera "</script><b>', image: "https://example.com/f.jpg" }, product.id,
  "https://example.com", "Demo")
  assert.ok(html.includes("og:image"))
  assert.ok(html.includes("Remera &quot;&lt;/script&gt;"))
  assert.ok(html.includes("\\u003c/script"))
  assert.ok(!html.includes("</script><b>"))
})
