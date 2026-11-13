import { useId, useMemo, useRef, useState } from "react"
import {
  FiAlertCircle, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight,
  FiFileText, FiRefreshCw, FiSave, FiSearch, FiUpload, FiX
} from "react-icons/fi"

import { useProductCategories } from "../../hooks/useProductCategories"
import {
  checkNewProductNames, getImportProducts, saveImportedProducts
} from "../../services/productImportService"
import {
  buildImportPreview, IMPORT_FIELDS, IMPORT_STATUS, importConflicts,
  matchesImportSearch, readProductExcel, searchText
} from "../../utils/productExcelImport"
import { formatMoney } from "../../utils/cartUtils"
import ProductCategorySelect from "./ProductCategorySelect"
import "./ProductExcelImport.css"

const PAGE_SIZE = 50
const BATCH_SIZE = 100
const EMPTY_SAVED = new Map()

function formatPrice(price) {
  return price === "" || price == null || !Number.isFinite(Number(price))
    ? "—"
    : formatMoney(price)
}

function ImportRow({ row, products, categoryName, selected, conflicts, onSelect, onChange }) {
  const { source, existing, options, number, status } = row
  const [editorOpen, setEditorOpen] = useState(false)
  const canEdit = row.inScope && status !== "saved"
  const suggestionIds = new Set(row.suggestions.map(({ product }) => product.id))

  function edit(field, value) {
    onChange(number, { ...options, edits: { ...options.edits, [field]: value } })
  }

  function valueFor(field) {
    return options.edits?.[field] ?? row.product?.[field] ??
      (source[field] !== "" && (field !== "name" || !existing) ? source[field] : existing?.[field]) ?? ""
  }

  return (
    <tr role="row" className={selected ? "pro-import-row--selected" : undefined}>
      <td role="cell" className="pro-import-select">
        <input
          type="checkbox"
          aria-label={`Seleccionar fila ${number}`}
          checked={selected}
          disabled={!row.selectable}
          onChange={event => onSelect(number, event.target.checked)}
        />
      </td>
      <td role="cell" className="pro-import-product">
        <strong>{String(source.name || "Sin nombre")}</strong>
        <small>Fila {number}{row.sourceCategory && ` · ${row.sourceCategory}`}</small>
        {existing && <small>En catálogo · {existing.name}</small>}
      </td>
      <td role="cell" className="pro-import-price pro-import-price--current">
        <span className="pro-import-mobile-label" aria-hidden="true">Precio actual</span>
        {formatPrice(existing?.price)}
      </td>
      <td role="cell" className="pro-import-price pro-import-price--next">
        <span className="pro-import-mobile-label" aria-hidden="true">Precio a guardar</span>
        <strong>{formatPrice(row.product?.price)}</strong>
        {row.product && <small>Stock {row.product.stock} · {row.product.active ? "Activo" : "Inactivo"}</small>}
      </td>
      <td role="cell" className="pro-import-row-details">
        <span className={`pro-import-status pro-import-status--${status}`}>{IMPORT_STATUS[status]}</span>
        {row.message && <small>{row.message}</small>}
        {row.similarRows.length > 0 && <small>Nombre repetido en filas {row.similarRows.join(", ")}.</small>}
        {conflicts && (
          <small className="pro-import-error">Conflicto con filas {[...conflicts].join(", ")}.</small>
        )}
        {!row.inScope && !row.mapped && (
          <button
            type="button"
            className="pro-import-button pro-import-button--quiet"
            onClick={() => onChange(number, { ...options, useCategory: true })}
          >
            Asignar a {categoryName}
          </button>
        )}
        {canEdit && (
          <details onToggle={event => setEditorOpen(event.currentTarget.open)}>
            <summary>Revisar o editar fila <FiChevronDown aria-hidden="true" /></summary>
            {editorOpen && <div className="pro-import-editor">
              <label>
                Producto de destino
                <select
                  value={options.target ?? ""}
                  onChange={event => onChange(number, { ...options, target: event.target.value, edits: {} })}
                >
                  <option value="">{row.exact ? "Usar coincidencia exacta" : "Comparación automática"}</option>
                  <option value="new">Crear como nuevo</option>
                  {row.suggestions.length > 0 && (
                    <optgroup label="Coincidencias sugeridas">
                      {row.suggestions.map(({ product, score }) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {Math.round(score * 100)}% · {formatPrice(product.price)} · {product.id.slice(-6)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Catálogo de la categoría">
                    {products.filter(product => !suggestionIds.has(product.id)).map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {formatPrice(product.price)} · {product.id.slice(-6)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              {row.options.useCategory && (
                <button
                  type="button"
                  className="pro-import-button pro-import-button--quiet"
                  onClick={() => onChange(number, { ...options, useCategory: false })}
                >
                  Deshacer asignación a {categoryName}
                </button>
              )}
              {status !== "review" && IMPORT_FIELDS.filter(([field]) => field !== "category").map(([field, label]) => {
                const value = valueFor(field)
                if (field === "active") {
                  return (
                    <label key={field}>
                      {label}
                      <select value={String(value)} onChange={event => edit(field, event.target.value)}>
                        {!["true", "false"].includes(String(value)) && (
                          <option value={String(value)}>{String(value) || "Elegí el estado"}</option>
                        )}
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                  )
                }
                return (
                  <label key={field}>
                    {label}
                    {field === "description"
                      ? <textarea rows={2} value={value} onChange={event => edit(field, event.target.value)} />
                      : <input
                          value={value}
                          inputMode={field === "price" ? "decimal" : field === "stock" ? "numeric" : undefined}
                          onChange={event => edit(field, event.target.value)}
                        />}
                  </label>
                )
              })}
            </div>}
          </details>
        )}
      </td>
    </tr>
  )
}

export default function ProductExcelImport() {
  const id = useId()
  const categoryState = useProductCategories()
  const [category, setCategory] = useState("")
  const [file, setFile] = useState(null)
  const [data, setData] = useState(null)
  const [rowOptions, setRowOptions] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [saved, setSaved] = useState(EMPTY_SAVED)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(null)
  const operation = useRef(false)

  const fileInput = useRef(null)

  const activeCategory = categoryState.categories.find(item => item.slug === category)
  const categoryName = activeCategory?.name || category
  const canLoad = Boolean(activeCategory) && !categoryState.loading && !categoryState.error
  const preview = useMemo(() => data
    ? buildImportPreview(data.rows, data.products, categoryState.categories, category, rowOptions, saved)
    : [], [data, categoryState.categories, category, rowOptions, saved])
  const matchingRows = useMemo(() => {
    const terms = searchText(search).split(" ").filter(Boolean)
    return terms.length ? preview.filter(row => matchesImportSearch(row, terms, categoryName)) : preview
  }, [preview, search, categoryName])
  const marked = preview.filter(row => row.selectable && selected.has(row.number))
  const conflicts = importConflicts(marked)
  const pages = Math.max(1, Math.ceil(matchingRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const visibleRows = matchingRows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const markedInSearch = matchingRows.filter(row => row.selectable && selected.has(row.number)).length
  const savedNew = [...saved.values()].filter(row => !row.existing).length
  const savedUpdated = saved.size - savedNew

  function resetPreview() {
    setData(null)
    setRowOptions({})
    setSelected(new Set())
    setSaved(EMPTY_SAVED)
    setPage(0)
    setError("")
    setProgress(null)
  }

  async function compare(nextFile) {
    if (operation.current) return
    operation.current = true
    resetPreview()
    setBusy("Comparando Excel…")
    try {
      const slug = categoryState.validateCategory(category)
      const rows = await readProductExcel(nextFile)
      const products = await getImportProducts(slug)
      products.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"))
      setData({ rows, products })
    } catch (failure) {
      setError(failure.message || "No se pudo comparar el Excel.")
    } finally {
      operation.current = false
      setBusy("")
    }
  }

  function select(number, checked) {
    setSelected(previous => {
      const next = new Set(previous)
      if (checked) next.add(number)
      else next.delete(number)
      return next
    })
  }

  function changeRow(number, options) {
    setRowOptions(previous => ({ ...previous, [number]: options }))
    select(number, false)
  }

  async function apply() {
    if (operation.current || !marked.length || conflicts.size) return
    try {
      categoryState.validateCategory(category)
    } catch (failure) {
      setError(failure.message)
      return
    }

    const creates = marked.filter(row => !row.existing).length
    const updates = marked.length - creates
    const summary = `${creates} ${creates === 1 ? "producto nuevo" : "productos nuevos"} y ${updates} ${updates === 1 ? "actualización" : "actualizaciones"}`
    if (!window.confirm(`¿Guardar ${summary} en ${categoryName}?`)) return

    operation.current = true
    setError("")
    setProgress({ done: 0, total: marked.length })
    setBusy("Guardando en Firebase…")
    try {
      checkNewProductNames(marked, await getImportProducts(category))
      for (let offset = 0; offset < marked.length; offset += BATCH_SIZE) {
        const batch = marked.slice(offset, offset + BATCH_SIZE)
        await saveImportedProducts(batch, activeCategory)
        setSaved(previous => new Map([
          ...previous,
          ...batch.map(row => [row.number, { ...row, status: "saved", selectable: false }])
        ]))
        setProgress({ done: offset + batch.length, total: marked.length })
      }
    } catch (failure) {
      setError(failure.message || "No se pudieron guardar los productos.")
    } finally {
      operation.current = false
      setBusy("")
    }
  }

  return (
    <section className="pro-import" aria-labelledby={`${id}-title`}>
      <header className="pro-import-header">
        <div className="pro-import-header-icon"><FiFileText aria-hidden="true" /></div>
        <div>
          <h2 id={`${id}-title`}>Importar productos desde Excel</h2>
        </div>
      </header>

      <fieldset className="pro-import-controls" disabled={Boolean(busy)}>
        <legend className="pro-import-sr-only">Archivo y categoría de destino</legend>
        <div className="pro-import-category">
          <label htmlFor={`${id}-category`}>Categoría de destino</label>
          <ProductCategorySelect
            id={`${id}-category`}
            value={category}
            categoryState={categoryState}
            onChange={slug => {
              resetPreview()
              setCategory(slug)
            }}
          />
        </div>
        <div className="pro-import-file">
          <input
            ref={fileInput}
            className="pro-import-sr-only"
            aria-label="Archivo Excel"
            type="file"
            tabIndex={-1}
            accept=".xlsx,.xls,.xlsm"
            disabled={!canLoad}
            onChange={event => {
              const next = event.target.files[0]
              event.target.value = ""
              if (!next) return
              setSearch("")
              setFile(next)
              compare(next)
            }}
          />
          <button
            className="pro-import-file-picker"
            type="button"
            disabled={!canLoad}
            onClick={() => fileInput.current?.click()}
          >
            <span className="pro-import-file-icon">
              {file ? <FiFileText aria-hidden="true" /> : <FiUpload aria-hidden="true" />}
            </span>
            <span className="pro-import-file-label">
              <strong>{file ? file.name : "Seleccionar archivo Excel"}</strong>
              <small>{file ? "Cambiar archivo" : ".xlsx, .xls o .xlsm"}</small>
            </span>
          </button>
        </div>

        <div className="pro-import-control-footer">
          <details className="pro-import-format">
            <summary>Formato de la planilla <FiChevronDown aria-hidden="true" /></summary>
            <p>
              Usá la primera hoja con encabezados. Para dar de alta productos, completá nombre y precio.
              También podés incluir categoría, stock, imagen, descripción y activo (Sí/No).
              Las celdas vacías conservan los valores existentes. Las filas sin categoría usan el destino elegido.
            </p>
          </details>
          {file && (
            <div className="pro-import-actions">
              <button type="button" className="pro-import-button pro-import-button--secondary" disabled={!canLoad} onClick={() => compare(file)}>
                <FiRefreshCw aria-hidden="true" /> {data ? "Volver a comparar" : "Comparar archivo"}
              </button>
              <button type="button" className="pro-import-button pro-import-button--quiet" onClick={() => {
                resetPreview()
                setFile(null)
                setSearch("")
              }}><FiX aria-hidden="true" /> Quitar archivo</button>
            </div>
          )}
        </div>
      </fieldset>

      {busy && <p className="pro-import-notice" role="status">{busy}</p>}
      {progress && (
        <div className="pro-import-progress" aria-live="polite">
          <progress aria-label="Progreso de guardado" max={progress.total} value={progress.done} />
          <span>{progress.done} de {progress.total} guardados en esta operación</span>
        </div>
      )}
      {saved.size > 0 && (
        <p className="pro-import-notice pro-import-notice--success" role="status">
          <FiCheckCircle aria-hidden="true" />
          {savedNew} {savedNew === 1 ? "nuevo" : "nuevos"} · {savedUpdated} {savedUpdated === 1 ? "actualizado" : "actualizados"}
        </p>
      )}
      {error && (
        <p className="pro-import-notice pro-import-notice--error" role="alert">
          <FiAlertCircle aria-hidden="true" /> {error}
        </p>
      )}

      {data && (
        <fieldset className="pro-import-preview" disabled={Boolean(busy)}>
          <legend className="pro-import-sr-only">Vista previa</legend>
          <div className="pro-import-preview-head">
            <h3>Vista previa</h3>
            <div className="pro-import-counts" aria-live="polite">
              <span>{matchingRows.length} de {preview.length} filas</span>
              <span className="pro-import-count--selected">{marked.length} seleccionadas</span>
            </div>
          </div>
          <div className="pro-import-toolbar">
            <div className="pro-import-search">
              <label htmlFor={`${id}-search`}>Buscar en el Excel</label>
              <div className="pro-import-search-box">
                <FiSearch aria-hidden="true" />
                <input
                  id={`${id}-search`}
                  type="search"
                  placeholder="Nombre, categoría, estado o fila"
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value)
                    setPage(0)
                  }}
                />
              </div>
            </div>
            <div className="pro-import-actions">
              <button
                className="pro-import-button pro-import-button--secondary"
                type="button"
                disabled={!matchingRows.some(row => row.selectable && row.existing)}
                onClick={() => setSelected(previous => new Set([
                  ...previous,
                  ...matchingRows.filter(row => row.selectable && row.existing).map(row => row.number)
                ]))}
              >Marcar actualizaciones{searchText(search) && " filtradas"}</button>
              <button className="pro-import-button pro-import-button--quiet" type="button" disabled={!marked.length} onClick={() => setSelected(new Set())}>
                Limpiar selección
              </button>
              <button
                className="pro-import-button pro-import-button--primary"
                type="button"
                disabled={!marked.length || Boolean(conflicts.size) || !canLoad}
                onClick={apply}
              ><FiSave aria-hidden="true" /> Aplicar en Firebase</button>
            </div>
          </div>
          {markedInSearch < marked.length && (
            <p className="pro-import-selection-note" role="status">La selección incluye filas fuera de la búsqueda.</p>
          )}
          {conflicts.size > 0 && (
            <p className="pro-import-notice pro-import-notice--error" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <span>Hay filas seleccionadas con el mismo producto o nombre de destino. Revisá las filas {[
                ...conflicts.keys()
              ].sort((a, b) => a - b).join(", ")}.</span>
            </p>
          )}
          {matchingRows.length === 0 ? (
            <p className="pro-import-empty" role="status"><FiSearch aria-hidden="true" /> No hay filas que coincidan con tu búsqueda.</p>
          ) : (
            <div className="pro-import-table-wrap">
              <table className="pro-import-table" role="table" aria-label="Tabla del Excel">
                <thead role="rowgroup">
                  <tr role="row">
                    {["Elegir", "Producto del Excel", "Precio actual", "Precio a guardar", "Estado y detalles"].map(label => (
                      <th role="columnheader" scope="col" key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {visibleRows.map(row => (
                    <ImportRow
                      key={row.number}
                      row={row}
                      products={data.products}
                      categoryName={categoryName}
                      selected={Boolean(row.selectable) && selected.has(row.number)}
                      conflicts={conflicts.get(row.number)}
                      onSelect={select}
                      onChange={changeRow}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <nav className="pro-import-pagination" aria-label="Páginas de la vista previa">
              <button className="pro-import-button pro-import-button--secondary" type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>
                <FiChevronLeft aria-hidden="true" /> Anterior
              </button>
              <span>Página {currentPage + 1} de {pages}</span>
              <button className="pro-import-button pro-import-button--secondary" type="button" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>
                Siguiente <FiChevronRight aria-hidden="true" />
              </button>
            </nav>
          )}
        </fieldset>
      )}
    </section>
  )
}
