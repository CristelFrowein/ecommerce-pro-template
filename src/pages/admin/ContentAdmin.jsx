import {
  useEffect,
  useRef,
  useState
} from "react"

import { toast } from "react-toastify"

import {
  createSlug,
  deleteContent,
  saveContent,
  setActiveBanner,
  subscribeContent
} from "../../services/contentService"

import "./ContentAdmin.css"

function emptyForm() {
  return {
    name: "",
    slug: "",
    order: "0",
    title: "",
    subtitle: "",
    buttonText: "",
    image: ""
  }
}

function ImagePreview({ url, alt }) {
  const [failed, setFailed] = useState(false)

  let valid = false

  try {
    const parsed = new URL(url)

    valid =
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
  } catch {
    valid = false
  }

  if (!valid || failed) {
    return (
      <div className="content-image-placeholder">
        {failed
          ? "No se pudo cargar la imagen."
          : "Pegá una URL completa para ver la imagen."}
      </div>
    )
  }

  return (
    <div className="content-image-preview">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function ContentAdmin({ type }) {
  const isCategories = type === "categories"

  const [items, setItems] = useState([])
  const [activeBannerId, setActiveBannerId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [attempt, setAttempt] = useState(0)

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)

  const lockRef = useRef(false)
  const formRef = useRef(null)

  useEffect(() => {
    return subscribeContent(
      type,
      state => {
        setItems(state.items)
        setActiveBannerId(state.activeBannerId)
        setLoading(false)
        setLoadError("")
      },
      error => {
        console.error(
          "Error al cargar contenido:",
          error
        )

        setLoadError(
          "No pudimos cargar esta sección."
        )

        setLoading(false)
      }
    )
  }, [type, attempt])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm())
  }

  function changeField(event) {
    const { name, value } = event.target

    setForm(previous => ({
      ...previous,
      [name]: value
    }))
  }

  async function perform(action, message) {
    if (lockRef.current) return false

    lockRef.current = true
    setBusy(true)

    try {
      await action()
      toast.success(message)
      return true
    } catch (error) {
      console.error("Error al guardar contenido:", error)

      toast.error(
        error.message ||
        "No se pudo completar la operación."
      )

      return false
    } finally {
      lockRef.current = false
      setBusy(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const saved = await perform(
      () => saveContent(type, form, editingId),
      editingId
        ? "Cambios guardados."
        : isCategories
          ? "Categoría creada."
          : "Banner creado."
    )

    if (saved) resetForm()
  }

  function startEditing(item) {
    if (lockRef.current) return

    setEditingId(item.id)

    setForm({
      ...emptyForm(),
      name: item.name || "",
      slug: item.slug || "",
      order: String(item.order ?? 0),
      title: item.title || "",
      subtitle: item.subtitle || "",
      buttonText: item.buttonText || "",
      image: item.image || ""
    })

    formRef.current?.scrollIntoView({
      behavior: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
        ? "auto"
        : "smooth",
      block: "start"
    })
  }

  async function handleDelete(item) {
    if (lockRef.current) return

    const name = isCategories
      ? item.name
      : item.title

    if (
      !window.confirm(
        `¿Eliminar "${name}"? Esta acción no se puede deshacer.`
      )
    ) {
      return
    }

    const deleted = await perform(
      () => deleteContent(type, item.id),
      isCategories
        ? "Categoría eliminada."
        : "Banner eliminado."
    )

    if (deleted && editingId === item.id) {
      resetForm()
    }
  }

  const title = isCategories
    ? "Categorías"
    : "Banners"

  const effectiveSlug = editingId
    ? form.slug
    : createSlug(form.name)

  return (
    <section
      className="content-admin"
      aria-busy={busy}
    >
      <div className="content-admin-heading">
        <div>
          <h2>{title}</h2>

          <p>
            {isCategories
              ? "Administrá las categorías y su orden de aparición."
              : "Administrá los banners y elegí cuál aparece en el inicio."}
          </p>
        </div>

        {!isCategories &&
          activeBannerId &&
          !loading &&
          !loadError && (
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              disabled={busy}
              onClick={() =>
                perform(
                  () => setActiveBanner(null),
                  "El banner quedó oculto del inicio."
                )
              }
            >
              Ocultar banner del inicio
            </button>
          )}
      </div>

      {loadError && (
        <div className="content-admin-error" role="alert">
          <p>{loadError}</p>

          <button
            type="button"
            className="admin-btn"
            disabled={busy}
            onClick={() => {
              setLoadError("")
              setLoading(true)
              setAttempt(previous => previous + 1)
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      <form
        ref={formRef}
        className="admin-card content-admin-form"
        onSubmit={handleSubmit}
      >
        <h3>
          {editingId
            ? isCategories
              ? "Editar categoría"
              : "Editar banner"
            : isCategories
              ? "Nueva categoría"
              : "Nuevo banner"}
        </h3>

        <fieldset
          disabled={busy || loading || Boolean(loadError)}
          className="content-form-fields"
        >
          <div className="content-field">
            <label htmlFor={`${type}-name`}>
              {isCategories ? "Nombre" : "Título"}
            </label>

            <input
              id={`${type}-name`}
              className="admin-input"
              type="text"
              name={isCategories ? "name" : "title"}
              value={isCategories ? form.name : form.title}
              onChange={changeField}
              maxLength={100}
              required
            />
          </div>

          {isCategories && (
            <>
              <div className="content-field">
                <label htmlFor="category-slug">
                  Identificador
                </label>

                <input
                  id="category-slug"
                  className="admin-input"
                  type="text"
                  value={effectiveSlug}
                  placeholder="Se genera con el nombre"
                  readOnly
                />

                <small>
                  Se usa para asociar los productos.
                  No cambia al editar el nombre.
                </small>
              </div>

              <div className="content-field">
                <label htmlFor="category-order">
                  Orden de aparición
                </label>

                <input
                  id="category-order"
                  className="admin-input"
                  type="number"
                  name="order"
                  min="0"
                  step="1"
                  value={form.order}
                  onChange={changeField}
                  required
                />

                <small>
                  Los números menores aparecen primero.
                </small>
              </div>
            </>
          )}

          {!isCategories && (
            <>
              <div className="content-field content-field-full">
                <label htmlFor="banner-subtitle">
                  Subtítulo
                </label>

                <textarea
                  id="banner-subtitle"
                  className="admin-input"
                  name="subtitle"
                  value={form.subtitle}
                  onChange={changeField}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="content-field">
                <label htmlFor="banner-button">
                  Texto del botón
                </label>

                <input
                  id="banner-button"
                  className="admin-input"
                  type="text"
                  name="buttonText"
                  value={form.buttonText}
                  onChange={changeField}
                  maxLength={80}
                  placeholder="Ver productos"
                />

                <small>
                  El botón lleva a los productos del inicio.
                  Dejalo vacío para ocultarlo.
                </small>
              </div>
            </>
          )}

          <div className="content-field content-field-full">
            <label htmlFor={`${type}-image`}>
              URL de la imagen
            </label>

            <input
              id={`${type}-image`}
              className="admin-input"
              type="url"
              name="image"
              value={form.image}
              onChange={changeField}
              placeholder="https://..."
              required
            />

            <small>
              Usá un enlace directo a una imagen.
            </small>
          </div>

          {form.image.trim() && (
            <div className="content-field-full">
              <ImagePreview
                key={form.image.trim()}
                url={form.image.trim()}
                alt="Vista previa de la imagen"
              />
            </div>
          )}

          <div className="content-form-actions content-field-full">
            <button
              type="submit"
              className="admin-btn"
            >
              {busy
                ? "Guardando..."
                : editingId
                  ? "Guardar cambios"
                  : isCategories
                    ? "Crear categoría"
                    : "Crear banner"}
            </button>

            {editingId && (
              <button
                type="button"
                className="content-secondary-btn"
                onClick={resetForm}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </fieldset>
      </form>

      <div className="content-list-heading">
        <h3>
          {title} guardados: {items.length}
        </h3>

        {!isCategories && !loading && (
          <p>
            {activeBannerId
              ? "Se muestra un solo banner en el inicio."
              : "El inicio no tiene un banner seleccionado."}
          </p>
        )}
      </div>

      {loading ? (
        <p role="status">Cargando...</p>
      ) : !loadError && items.length === 0 ? (
        <p className="content-empty">
          {isCategories
            ? "Todavía no hay categorías."
            : "Todavía no hay banners."}
        </p>
      ) : (
        <div className="content-admin-list">
          {items.map(item => {
            const active =
              !isCategories &&
              item.id === activeBannerId

            return (
              <article
                key={item.id}
                className="admin-card content-entry"
              >
                <ImagePreview
                  key={item.image}
                  url={item.image || ""}
                  alt={
                    isCategories
                      ? item.name
                      : item.title
                  }
                />

                <div className="content-entry-body">
                  <div className="content-entry-heading">
                    <h4>
                      {isCategories
                        ? item.name
                        : item.title}
                    </h4>

                    {active && (
                      <span className="content-active-badge">
                        Visible en el inicio
                      </span>
                    )}
                  </div>

                  {isCategories ? (
                    <>
                      <p>
                        Identificador: <strong>{item.slug}</strong>
                      </p>

                      <p>
                        Orden: {item.order ?? 0}
                      </p>
                    </>
                  ) : (
                    <>
                      {item.subtitle && (
                        <p>{item.subtitle}</p>
                      )}

                      {item.buttonText && (
                        <p>
                          Botón: {item.buttonText}
                        </p>
                      )}
                    </>
                  )}

                  <div className="content-entry-actions">
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busy}
                      onClick={() => startEditing(item)}
                    >
                      Editar
                    </button>

                    {!isCategories && !active && (
                      <button
                        type="button"
                        className="content-secondary-btn"
                        disabled={busy}
                        onClick={() =>
                          perform(
                            () => setActiveBanner(item.id),
                            "Banner seleccionado para el inicio."
                          )
                        }
                      >
                        Mostrar en el inicio
                      </button>
                    )}

                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      disabled={busy}
                      onClick={() => handleDelete(item)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ContentAdmin