import process from "node:process"
import { getAdminDb } from "../server/firebaseAdmin.js"
import { appOrigin } from "../server/http.js"
import { availableStock, offerInfo } from "../src/utils/commerce.js"

const escape = input => String(input ?? "").replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])

function absoluteImage(value, origin) {
  try {
    if (!value) return ""
    const url = new URL(value, origin)
    return ["https:", "http:"].includes(url.protocol) ? url.href : ""
  } catch { return "" }
}

export function renderProductPage(html, product, id, origin, store) {
  const name = String(product.name || "Producto").slice(0, 150)
  const title = `${name} | ${store}`
  const description = String(product.description || `Conocé ${name} en ${store}.`).replace(/\s+/g, " ").trim().slice(0, 190)
  const image = absoluteImage(product.image || product.images?.[0], origin)
  const url = `${origin}/producto/${encodeURIComponent(id)}`
  const price = offerInfo(product).price
  const structured = { "@context": "https://schema.org", "@type": "Product", name, description,
    ...(product.sku ? { sku: product.sku } : {}), ...(image ? { image } : {}),
    ...(Number.isFinite(price) && price >= 0 ? { offers: {
      "@type": "Offer", price, priceCurrency: "ARS", url,
      availability: availableStock(product) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    } } : {})
  }
  const tags = [
    `<meta name="description" content="${escape(description)}">`,
    `<link rel="canonical" href="${escape(url)}">`,
    ...Object.entries({
      "og:type": "product", "og:title": title, "og:description": description, "og:url": url,
      "og:site_name": store, ...(image ? { "og:image": image } : {})
    }).map(([property, content]) => `<meta property="${property}" content="${escape(content)}">`),
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script>`
  ].join("\n")
  return html.replace(/<title>[^<]*<\/title>/i, () => `<title>${escape(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, "")
    .replace(/<\/head>/i, () => `${tags}\n</head>`)
}

export default async function handler(req, res) {
  if (!["HEAD", "GET"].includes(req.method)) return res.status(405).end()
  try {
    const url = new URL(req.url, "https://local.invalid")
    const id = /^\/producto\/([\w-]+)\/?$/.exec(url.pathname)?.[1] || req.query?.id || url.searchParams.get("id")
    if (typeof id !== "string" || !/^[\w-]{1,200}$/.test(id)) return res.status(404).end()
    const origin = appOrigin()
    const [document, app] = await Promise.all([
      getAdminDb().collection("products").doc(id).get(),
      fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(5000) })
    ])
    if (!app.ok) throw new Error("No se encontró el HTML de Vite.")
    const html = await app.text()
    const product = document.data()
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    if (!product || product.active === false) {
      res.setHeader("X-Robots-Tag", "noindex")
      return res.status(404).send(html)
    }
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120")
    return res.send(renderProductPage(html, product, id, origin, process.env.VITE_STORE_NAME || "Demo Store"))
  } catch (error) {
    console.error("Error cargando la ficha de producto", error.message)
    res.setHeader("Cache-Control", "no-store")
    return res.status(503).send("La ficha del producto no está disponible temporalmente.")
  }
}
