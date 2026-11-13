import { validateProductNumbers } from "./productValidation.js"

export const IMPORT_FIELDS = [
  ["name", "Nombre", ["nombre", "producto"]],
  ["category", "Categoría", ["categoria"]],
  ["price", "Precio", ["precio"]],
  ["stock", "Stock", ["cantidad", "existencias"]],
  ["image", "Imagen principal", ["imagen", "img", "url imagen"]],
  ["description", "Descripción", ["descripcion"]],
  ["active", "Activo", ["activo", "estado"]]
]

export const IMPORT_STATUS = {
  new: "Nuevo",
  price: "Actualizar precio",
  details: "Actualizar detalles",
  both: "Actualizar precio y detalles",
  review: "Revisar coincidencia",
  unchanged: "Sin cambios",
  invalid: "Revisar fila",
  outside: "Fuera de la categoría",
  saved: "Guardado"
}

const headers = new Map(IMPORT_FIELDS.flatMap(([field, , aliases]) =>
  [field, ...aliases].map(alias => [alias, field])
))

const text = value => String(value ?? "").trim()

export function searchText(value) {
  return text(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ")
}

const categoryKey = value => searchText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim()
export const productKey = value => searchText(value)
export const importIdentity = (category, name) => JSON.stringify([category, productKey(name)])

export function parseProductSheet(sheetRows, firstRow = 1) {
  const headerIndex = sheetRows.findIndex(row => row.some(value => text(value)))
  if (headerIndex === -1) throw new Error("La primera hoja está vacía.")

  const columns = sheetRows[headerIndex].map(value => headers.get(searchText(value)))
  const known = columns.filter(Boolean)
  if (!known.includes("name")) throw new Error('La primera hoja debe incluir una columna "name" o "nombre".')
  if (new Set(known).size !== known.length) {
    throw new Error("Hay dos encabezados para el mismo campo. Dejá una sola columna por campo.")
  }

  const rows = sheetRows.slice(headerIndex + 1).flatMap((cells, index) => {
    if (!columns.some((field, column) => field && text(cells[column]))) return []
    const source = Object.fromEntries(IMPORT_FIELDS.map(([field]) => [field, ""]))
    columns.forEach((field, column) => {
      if (field) source[field] = cells[column] ?? ""
    })
    return [{ number: firstRow + headerIndex + index + 1, source }]
  })
  if (!rows.length) throw new Error("La primera hoja no tiene filas de productos.")
  return rows
}

export async function readProductExcel(file) {
  const { read, utils } = await import("xlsx")
  const workbook = read(await file.arrayBuffer(), { type: "array" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet?.["!ref"]) throw new Error("La primera hoja está vacía.")
  return parseProductSheet(
    utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: true, raw: true }),
    utils.decode_range(sheet["!ref"]).s.r + 1
  )
}

function importNumber(value) {
  if (typeof value === "number") return value
  const formatted = text(value).replace(/^(?:ARS\s*\$?|\$)\s*/i, "").replace(/\s/g, "")
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(formatted)) {
    return formatted.replaceAll(".", "").replace(",", ".")
  }
  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(formatted)) return formatted.replaceAll(",", "")
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(formatted)) return formatted.replace(",", ".")
  return formatted ? NaN : ""
}

function importActive(value) {
  const normalized = searchText(value)
  if (["si", "true", "1", "activo", "activa"].includes(normalized)) return true
  if (["no", "false", "0", "inactivo", "inactiva"].includes(normalized)) return false
  throw new Error("Indicá si el producto está activo con Sí o No.")
}

function productChanges(source, existing, edits, category) {
  const name = text(edits.name ?? (existing?.name || source.name))
  if (!name) throw new Error("Completá el nombre.")
  const { price, stock } = validateProductNumbers({
    price: importNumber(edits.price ?? (text(source.price) ? source.price : existing?.price)),
    stock: importNumber(edits.stock ?? (text(source.stock) ? source.stock : existing?.stock ?? 0))
  })
  const active = importActive(edits.active ?? (text(source.active) ? source.active : existing?.active !== false))
  const image = text(edits.image ?? (text(source.image) ? source.image : existing?.image))
  const description = text(edits.description ?? (text(source.description) ? source.description : existing?.description))

  if (image && image !== text(existing?.image)) {
    try {
      if (!["https:", "http:"].includes(new URL(image).protocol)) throw new Error()
    } catch {
      throw new Error("La imagen debe tener una URL completa http o https.")
    }
  }

  const product = { name, category, price, stock, active, image, description }
  if (!existing) {
    return { product, changes: { ...product, images: image ? [image] : [], attributes: [] } }
  }

  const before = {
    name: text(existing.name), category: existing.category, price: Number(existing.price),
    stock: Number(existing.stock ?? 0), active: existing.active !== false,
    image: text(existing.image), description: text(existing.description)
  }
  const changes = Object.fromEntries(Object.entries(product).filter(([field, value]) => value !== before[field]))
  if ("image" in changes) {
    const gallery = Array.isArray(existing.images) ? existing.images : []
    const additional = gallery.filter(url => url !== before.image && url !== image)
    changes.images = image ? [image, ...additional] : additional
  }
  return { product, changes }
}

function nameTokens(name) {
  return new Set(searchText(name).match(/[\p{L}\p{N}+#]+/gu) ?? [])
}

function nameSuggestions(name, tokenIndex, tokenCounts) {
  const tokens = nameTokens(name)
  const scores = new Map()
  for (const token of tokens) {
    for (const product of tokenIndex.get(token) ?? []) {
      scores.set(product, (scores.get(product) ?? 0) + 1)
    }
  }
  return [...scores].flatMap(([product, shared]) => {
    const score = (2 * shared) / (tokens.size + tokenCounts.get(product.id))
    return score >= 0.64 ? [{ product, score }] : []
  }).sort((a, b) => b.score - a.score).slice(0, 5)
}

export function buildImportPreview(rows, products, categories, category, rowOptions, saved) {
  const byId = new Map(products.map(product => [product.id, product]))
  const byName = new Map()
  const byExcelName = new Map()
  const tokenIndex = new Map()
  const tokenCounts = new Map()
  for (const product of products) {
    const key = productKey(product.name)
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(product)
    const tokens = nameTokens(product.name)
    tokenCounts.set(product.id, tokens.size)
    for (const token of tokens) {
      if (!tokenIndex.has(token)) tokenIndex.set(token, [])
      tokenIndex.get(token).push(product)
    }
  }
  const categoryAliases = new Map()
  for (const entry of categories) {
    for (const key of new Set([categoryKey(entry.name), categoryKey(entry.slug)])) {
      if (!key) continue
      if (!categoryAliases.has(key)) categoryAliases.set(key, [])
      categoryAliases.get(key).push(entry.slug)
    }
  }

  const scoped = rows.map(row => {
    const options = rowOptions[row.number] ?? {}
    const sourceCategory = text(row.source.category)
    const slug = categories.find(entry => entry.slug === sourceCategory)?.slug
    const aliases = categoryAliases.get(categoryKey(sourceCategory)) ?? []
    const mapped = slug ?? (aliases.length === 1 ? aliases[0] : "")
    const inScope = options.useCategory || !sourceCategory || mapped === category
    if (inScope) {
      const key = productKey(row.source.name)
      if (!byExcelName.has(key)) byExcelName.set(key, [])
      byExcelName.get(key).push(row.number)
    }
    return { ...row, options, sourceCategory, mapped, inScope }
  })

  return scoped.map(row => {
    if (saved.has(row.number)) return saved.get(row.number)
    const { source, options, sourceCategory, mapped, inScope } = row
    const base = { ...row, suggestions: [], similarRows: [] }
    if (!inScope) {
      return {
        ...base,
        status: mapped ? "outside" : "invalid",
        message: mapped
          ? `La categoría «${sourceCategory}» corresponde a otra categoría del panel.`
          : `Revisá la categoría «${sourceCategory}». Elegí un destino existente para esta fila.`
      }
    }

    const name = options.edits?.name ?? source.name
    const key = productKey(source.name)
    const exact = key ? byName.get(key) ?? [] : []
    const existing = options.target === "new"
      ? undefined
      : options.target ? byId.get(options.target) : exact.length === 1 ? exact[0] : undefined
    const suggestions = exact.length > 1
      ? exact.map(product => ({ product, score: 1 }))
      : existing ? [] : nameSuggestions(name, tokenIndex, tokenCounts)
    const similarRows = key ? byExcelName.get(key).filter(number => number !== row.number) : []
    const matched = { ...base, existing, suggestions, similarRows, exact: exact.length === 1 }

    if (!existing && !options.target && (suggestions.length || similarRows.length)) {
      return { ...matched, status: "review", message: "Elegí un producto existente o confirmá el alta." }
    }

    try {
      const { product, changes } = productChanges(source, existing, options.edits ?? {}, category)
      const sameName = byName.get(productKey(product.name)) ?? []
      if (
        (!existing || productKey(product.name) !== productKey(existing.name)) &&
        sameName.some(item => item.id !== existing?.id)
      ) {
        throw new Error("Ya existe un producto con ese nombre. Revisá la coincidencia o cambiá el nombre.")
      }

      const priceChanged = Object.hasOwn(changes, "price")
      const detailsChanged = Object.keys(changes).some(field => field !== "price")
      const status = !existing ? "new"
        : priceChanged && detailsChanged ? "both"
          : priceChanged ? "price"
            : detailsChanged ? "details" : "unchanged"
      return { ...matched, product, changes, status, selectable: status !== "unchanged" }
    } catch (error) {
      return { ...matched, status: "invalid", message: error.message }
    }
  })
}

export function importConflicts(selected) {
  const targets = new Map()
  const names = new Map()
  const conflicts = new Map()
  for (const row of selected) {
    const target = row.existing?.id
    if (target) {
      if (!targets.has(target)) targets.set(target, [])
      targets.get(target).push(row)
    }
    const identity = importIdentity(row.product.category, row.product.name)
    if (!names.has(identity)) names.set(identity, [])
    names.get(identity).push(row)
  }
  for (const group of [...targets.values(), ...names.values()]) {
    if (group.length < 2) continue
    for (const row of group) {
      const others = conflicts.get(row.number) ?? new Set()
      group.forEach(other => {
        if (other.number !== row.number) others.add(other.number)
      })
      conflicts.set(row.number, others)
    }
  }
  return conflicts
}

export function matchesImportSearch(row, terms, categoryName) {
  const searchable = searchText([
    row.number, ...Object.values(row.source), ...Object.values(row.options.edits ?? {}),
    row.existing?.name, row.existing?.price, row.product?.price, row.product?.stock,
    row.inScope ? categoryName : "", row.message, IMPORT_STATUS[row.status]
  ].join(" "))
  return terms.every(term => searchable.includes(term))
}