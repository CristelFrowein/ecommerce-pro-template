import "./ProductCategorySelect.css"

function ProductCategorySelect({
  id,
  value,
  onChange,
  categoryState,
  disabled = false
}) {
  const {
    categories,
    loading,
    error,
    retry
  } = categoryState

  const selectedValue = String(value ?? "")

  const unknown =
    !loading &&
    !error &&
    selectedValue !== "" &&
    !categories.some(
      category => category.slug === selectedValue
    )

  const hintId = `${id}-hint`

  let placeholder = "Seleccioná una categoría"
  let hint = "Elegí una de las categorías creadas en el panel."

  if (loading) {
    placeholder = "Cargando categorías..."
    hint = "Cargando las categorías del panel."
  } else if (error) {
    placeholder = "No se pudieron cargar"
    hint = error
  } else if (unknown) {
    hint =
      "La categoría anterior no está disponible. Seleccioná una de la lista."
  } else if (categories.length === 0) {
    placeholder = "No hay categorías disponibles"
    hint =
      "Primero creá una categoría desde el menú Categorías."
  }

  return (
    <>
      <select
        id={id}
        className="product-category-select"
        value={selectedValue}
        required
        disabled={
          disabled ||
          loading ||
          Boolean(error) ||
          categories.length === 0
        }
        aria-invalid={unknown || undefined}
        aria-describedby={hintId}
        onChange={event =>
          onChange(event.target.value)
        }
      >
        <option value="">
          {placeholder}
        </option>

        {unknown && (
          <option
            value={selectedValue}
            disabled
          >
            {selectedValue} · Elegí una categoría válida
          </option>
        )}

        {categories.map(category => (
          <option
            key={category.id}
            value={category.slug}
          >
            {category.name || category.slug}
          </option>
        ))}
      </select>

      <p
        id={hintId}
        className="product-category-help"
        role={error ? "alert" : undefined}
      >
        {hint}
      </p>

      {error && (
        <button
          type="button"
          className="product-category-retry"
          disabled={disabled}
          onClick={retry}
        >
          Reintentar categorías
        </button>
      )}
    </>
  )
}

export default ProductCategorySelect