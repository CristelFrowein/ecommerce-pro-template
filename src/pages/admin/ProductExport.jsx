import { useState } from "react"
import { collection, getDocs, query, where, limit, startAfter } from "firebase/firestore"
import { db } from "../../services/firebase"
import { useProductCategories } from "../../hooks/useProductCategories"
import { IMPORT_FIELDS } from "../../utils/productExcelImport"
import "./CommerceAdmin.css"

function productRow(product) {
  const values = { ...product, active: product.active !== false, featured: product.featured === true,
    attributes: JSON.stringify(product.attributes || []), variants: JSON.stringify((product.variants || []).map(({ id, options, stock, sku, image }) => ({ id, options, stock, sku, image }))),
    images: JSON.stringify(product.images || (product.image ? [product.image] : [])) }
  return IMPORT_FIELDS.map(([field]) => values[field] ?? "")
}

export default function ProductExport() {
  const { categories } = useProductCategories()
  const [category, setCategory] = useState("")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")

  async function download(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setStatus("")
    try {
      const { utils, writeFile } = await import("xlsx")
      const constraints = [ ...(category ? [where("category", "==", category)] : []), limit(300)]
      const rows = []
      let cursor
      let count
      do {
        const result = await getDocs(query(collection(db, "products"), ...constraints, ...(cursor ? [startAfter(cursor)] : [])))
        rows.push(...result.docs.map(doc => ({ ...doc.data(), id: doc.id })))
        count = result.size
        cursor = result.docs.at(-1)
      } while (count === 300)
      rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es-AR", { numeric: true }))
      const workbook = utils.book_new()
      const sheet = utils.aoa_to_sheet([IMPORT_FIELDS.map(([field]) => field), ...rows.map(productRow)])
      sheet["!cols"] = IMPORT_FIELDS.map(([field]) => ({ wch: field === "name" ? 40 : 18 }))
      utils.book_append_sheet(workbook, sheet, "Productos")
      utils.book_append_sheet(workbook, utils.aoa_to_sheet([
        ["Importación"], ["Elegí una categoría antes de importar. El ID identifica la fila dentro de esa categoría."],
        ["Si falta el ID, se intenta coincidir por SKU y luego por nombre."],
        ["Las columnas images, attributes y variants contienen JSON. Conservá el formato o dejá la celda vacía para mantener el valor."],
        ["Usá [] para limpiar una lista. Para las variantes existentes, conservá su ID."]
      ]), "Cómo importar")
      writeFile(workbook, `productos-${category || "completo"}.xlsx`)
      setStatus(`${rows.length} productos exportados.`)
    } catch (failure) { setError(failure.message || "No pudimos descargar el catálogo.") }
    finally { setBusy(false) }
  }

  return <section className="commerce-admin">
    <h2>Exportar catálogo</h2>
    <form onSubmit={download}><fieldset disabled={busy}>
      <label>Categoría<select value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">Todas las categorías</option>
        {categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
      </select></label>
      <button>{busy ? "Preparando…" : "Descargar Excel"}</button>
    </fieldset></form>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
