import {
  useEffect,
  useRef,
  useState
} from "react"

import {
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  limit,
  startAfter
} from "firebase/firestore"

import { db } from "../../services/firebase"

import {
  useProductCategories
} from "../../hooks/useProductCategories"

import {
  validateProductNumbers
} from "../../utils/productValidation"

import ProductCategorySelect from "./ProductCategorySelect"

import "./ProductsAdmin.css"

const PRODUCTS_PER_PAGE = 10

function ProductsAdmin({ onBack }) {
  const [products, setProducts] = useState([])

  const [currentPage, setCurrentPage] = useState(1)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadError, setLoadError] = useState("")
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(true)

  const [updating, setUpdating] = useState({})
  const [updated, setUpdated] = useState({})

  const pageCursors = useRef([])
  const categoryState = useProductCategories()

  // ==============================
  // CARGAR PRODUCTOS
  // ==============================

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      try {
        const productsRef = collection(
          db,
          "products"
        )

        const previousCursor =
          pageCursors.current[currentPage - 1]

        if (
          currentPage > 1 &&
          !previousCursor
        ) {
          throw new Error(
            "No se pudo recuperar la página anterior."
          )
        }

        // Pedimos uno adicional para saber
        // si realmente hay otra página.
        const productsQuery = currentPage === 1
          ? query(
              productsRef,
              limit(PRODUCTS_PER_PAGE + 1)
            )
          : query(
              productsRef,
              startAfter(previousCursor),
              limit(PRODUCTS_PER_PAGE + 1)
            )

        const snap = await getDocs(productsQuery)

        if (cancelled) return

        const visible = snap.docs.slice(
          0,
          PRODUCTS_PER_PAGE
        )

        pageCursors.current[currentPage] =
          visible[visible.length - 1] || null

        setProducts(
          visible.map(document => ({
            ...document.data(),
            id: document.id
          }))
        )

        setHasNextPage(
          snap.docs.length > PRODUCTS_PER_PAGE
        )

        setLoadError("")
      } catch (error) {
        console.error(
          "Error al cargar productos:",
          error
        )

        if (!cancelled) {
          setLoadError(
            "No pudimos cargar los productos. Intentá nuevamente."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [currentPage, loadAttempt])

  function retryProducts() {
    setLoading(true)
    setLoadError("")
    setLoadAttempt(previous => previous + 1)
  }

  // ==============================
  // CAMPOS SIMPLES
  // ==============================

  function handleChange(id, field, value) {
    setProducts(previous =>
      previous.map(product =>
        product.id === id
          ? { ...product, [field]: value }
          : product
      )
    )

    setUpdated(previous => ({
      ...previous,
      [id]: false
    }))
  }

  // ==============================
  // IMÁGENES
  // ==============================

  function getProductImages(product) {
    if (Array.isArray(product.images)) {
      return product.images
    }

    if (
      product.image &&
      typeof product.image === "string"
    ) {
      return [product.image]
    }

    return []
  }

  function handleImageChange(
    productId,
    imageIndex,
    value
  ) {
    setProducts(previous =>
      previous.map(product => {
        if (product.id !== productId) {
          return product
        }

        const images = [
          ...getProductImages(product)
        ]

        images[imageIndex] = value

        return {
          ...product,
          images,
          image: images[0] || ""
        }
      })
    )

    setUpdated(previous => ({
      ...previous,
      [productId]: false
    }))
  }

  function handleAddImage(productId) {
    setProducts(previous =>
      previous.map(product =>
        product.id === productId
          ? {
              ...product,
              images: [
                ...getProductImages(product),
                ""
              ]
            }
          : product
      )
    )

    setUpdated(previous => ({
      ...previous,
      [productId]: false
    }))
  }

  function handleRemoveImage(
    productId,
    imageIndex
  ) {
    setProducts(previous =>
      previous.map(product => {
        if (product.id !== productId) {
          return product
        }

        const images = getProductImages(product)
          .filter(
            (_, index) => index !== imageIndex
          )

        return {
          ...product,
          images,
          image: images[0] || ""
        }
      })
    )

    setUpdated(previous => ({
      ...previous,
      [productId]: false
    }))
  }

  // ==============================
  // ATRIBUTOS
  // ==============================

  function handleAttributeChange(
    productId,
    attributeIndex,
    field,
    value
  ) {
    setProducts(previous =>
      previous.map(product =>
        product.id === productId
          ? {
              ...product,
              attributes: (
                product.attributes || []
              ).map((attribute, index) =>
                index === attributeIndex
                  ? { ...attribute, [field]: value }
                  : attribute
              )
            }
          : product
      )
    )

    setUpdated(previous => ({
      ...previous,
      [productId]: false
    }))
  }

  function handleOptionChange(
    productId,
    attributeIndex,
    optionIndex,
    value
  ) {
    setProducts(previous =>
      previous.map(product => {
        if (product.id !== productId) {
          return product
        }

        const attributes = (
          product.attributes || []
        ).map((attribute, index) => {
          if (index !== attributeIndex) {
            return attribute
          }

          const options = [
            ...(attribute.options || [])
          ]

          options[optionIndex] = value

          return { ...attribute, options }
        })

        return { ...product, attributes }
      })
    )

    setUpdated(previous => ({
      ...previous,
      [productId]: false
    }))
  }

  function handleAddOption(
    productId,
    attributeIndex
  ) {
    setProducts(previous =>
      previous.map(product =>
        product.id === productId
          ? {
              ...product,
              attributes: (
                product.attributes || []
              ).map((attribute, index) =>
                index === attributeIndex
                  ? {
                      ...attribute,
                      options: [
                        ...(attribute.options || []),
                        ""
                      ]
                    }
                  : attribute
              )
            }
          : product
      )
    )

    setUpdated(previous => ({
      ...previous,
      [productId]: false
    }))
  }

  function handleRemoveOption(
    productId,
    attributeIndex,
    optionIndex
  ) {
    setProducts(previous =>
      previous.map(product =>
        product.id === productId
          ? {
              ...product,
              attributes: (
                product.attributes || []
              ).map((attribute, index) =>
                index === attributeIndex
                  ? {
                      ...attribute,
                      options: (
                        attribute.options || []
                      ).filter(
                        (_, indexToRemove) =>
                          indexToRemove !== optionIndex
                      )
                    }
                  : attribute
              )
            }
          : product
      )
    )

    setUpdated(previous => ({
      ...previous,
      [productId]: false
    }))
  }

  function handleRemoveAttribute(
    productId,
    attributeIndex
  ) {
    setProducts(previous =>
      previous.map(product =>
        product.id === productId
          ? {
              ...product,
              attributes: (
                product.attributes || []
              ).filter(
                (_, index) =>
                  index !== attributeIndex
              )
            }
          : product
      )
    )

    setUpdated(previous => ({
      ...previous,
      [productId]: false
    }))
  }

  // ==============================
  // GUARDAR CAMBIOS
  // ==============================

  async function handleUpdate(product) {
    if (updating[product.id]) return

    setUpdating(previous => ({
      ...previous,
      [product.id]: true
    }))

    setUpdated(previous => ({
      ...previous,
      [product.id]: false
    }))

    try {
      const validatedNumbers =
        validateProductNumbers(product)

      const category =
        categoryState.validateCategory(
          product.category
        )

      const name = (
        product.name || ""
      ).trim()

      if (!name) {
        throw new Error(
          "Completá el nombre del producto."
        )
      }

      const images = getProductImages(product)
        .map(image => image.trim())
        .filter(Boolean)

      const attributes = (
        product.attributes || []
      )
        .map(attribute => {
          if (attribute.type === "select") {
            return {
              name: (
                attribute.name || ""
              ).trim(),
              type: "select",
              options: (
                attribute.options || []
              )
                .map(option => option.trim())
                .filter(Boolean),
              required:
                attribute.required !== false
            }
          }

          return {
            name: (
              attribute.name || ""
            ).trim(),
            type: "info",
            value: (
              attribute.value || ""
            ).trim()
          }
        })
        .filter(attribute => attribute.name)

      await updateDoc(
        doc(db, "products", product.id),
        {
          name,
          price: validatedNumbers.price,
          category,
          description: (
            product.description || ""
          ).trim(),
          stock: validatedNumbers.stock,
          active: product.active !== false,
          image: images[0] || "",
          images,
          attributes
        }
      )

      setUpdated(previous => ({
        ...previous,
        [product.id]: true
      }))

      setTimeout(() => {
        setUpdated(previous => ({
          ...previous,
          [product.id]: false
        }))
      }, 2500)
    } catch (error) {
      console.error(
        "Error al actualizar producto:",
        error
      )

      alert(
        error.message ||
        "No se pudo actualizar el producto."
      )
    } finally {
      setUpdating(previous => ({
        ...previous,
        [product.id]: false
      }))
    }
  }

  // ==============================
  // ELIMINAR
  // ==============================

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar este producto?\n\n" +
      "Esta acción no se puede deshacer."
    )

    if (!confirmed) return

    try {
      await deleteDoc(
        doc(db, "products", id)
      )

      setProducts(previous =>
        previous.filter(
          product => product.id !== id
        )
      )
    } catch (error) {
      console.error(
        "Error al eliminar producto:",
        error
      )

      alert(
        "No se pudo eliminar el producto."
      )
    }
  }

  // ==============================
  // PAGINACIÓN
  // ==============================

  function handleNextPage() {
    if (!hasNextPage) return

    setLoading(true)
    setLoadError("")
    setCurrentPage(previous => previous + 1)
  }

  function handlePreviousPage() {
    if (currentPage === 1) return

    setLoading(true)
    setLoadError("")
    setCurrentPage(previous => previous - 1)
  }

  // ==============================
  // VISTA
  // ==============================

  return (
    <div className="products-admin">
      <div className="products-admin-header">
        <div className="products-admin-title">
          <h2>Productos</h2>

          <p>
            Administrá toda la información
            de tus productos
          </p>
        </div>

        <button
          type="button"
          className="products-back"
          onClick={onBack}
        >
          ← Volver
        </button>
      </div>

      <div className="products-admin-list">
        {loading ? (
          <div className="products-empty">
            <span>⏳</span>
            <h3>Cargando productos...</h3>
          </div>
        ) : loadError ? (
          <div
            className="products-empty"
            role="alert"
          >
            <p>{loadError}</p>

            <button
              type="button"
              className="products-back"
              onClick={retryProducts}
            >
              Reintentar
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="products-empty">
            <span>📦</span>
            <h3>No hay productos</h3>
            <p>
              Todavía no hay productos cargados.
            </p>
          </div>
        ) : (
          products.map(product => {
            const images =
              getProductImages(product)

            return (
              <article
                key={product.id}
                className="product-admin"
              >
                <aside className="product-admin-sidebar">
                  <div className="product-admin-image">
                    <img
                      src={
                        images[0] ||
                        "https://via.placeholder.com/300x300?text=Sin+imagen"
                      }
                      alt={product.name || "Producto"}
                      onError={event => {
                        event.currentTarget.src =
                          "https://via.placeholder.com/300x300?text=Sin+imagen"
                      }}
                    />
                  </div>

                  <span className="product-admin-id">
                    ID: {product.id}
                  </span>
                </aside>

                <div className="product-admin-content">
                  <div className="product-admin-fields">
                    <div className="product-field">
                      <label>Nombre</label>

                      <input
                        type="text"
                        value={product.name || ""}
                        onChange={event =>
                          handleChange(
                            product.id,
                            "name",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="product-field">
                      <label>Precio</label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.price ?? ""}
                        onChange={event =>
                          handleChange(
                            product.id,
                            "price",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="product-field">
                      <label
                        htmlFor={`edit-category-${product.id}`}
                      >
                        Categoría
                      </label>

                      <ProductCategorySelect
                        id={`edit-category-${product.id}`}
                        value={product.category || ""}
                        categoryState={categoryState}
                        disabled={
                          Boolean(updating[product.id])
                        }
                        onChange={value =>
                          handleChange(
                            product.id,
                            "category",
                            value
                          )
                        }
                      />
                    </div>

                    <div className="product-field">
                      <label>Stock</label>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={product.stock ?? 0}
                        onChange={event =>
                          handleChange(
                            product.id,
                            "stock",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="product-field product-field-full">
                      <label>Descripción</label>

                      <textarea
                        value={
                          product.description || ""
                        }
                        rows="5"
                        placeholder="Descripción del producto..."
                        onChange={event =>
                          handleChange(
                            product.id,
                            "description",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* GALERÍA */}
                  <section className="product-images-admin product-field-full">
                    <div className="product-images-header">
                      <div>
                        <h4>Imágenes del producto</h4>
                        <p>
                          La primera imagen será la principal.
                        </p>
                      </div>

                      <span className="product-images-count">
                        {images.length}{" "}
                        {images.length === 1
                          ? "imagen"
                          : "imágenes"}
                      </span>
                    </div>

                    <div className="product-images-list">
                      {images.length === 0 && (
                        <div className="product-no-images">
                          Todavía no hay imágenes.
                        </div>
                      )}

                      {images.map(
                        (image, imageIndex) => (
                          <div
                            key={imageIndex}
                            className="product-image-admin-row"
                          >
                            <div className="product-image-admin-preview">
                              <img
                                src={
                                  image ||
                                  "https://via.placeholder.com/100x100?text=Sin+imagen"
                                }
                                alt={`Imagen ${imageIndex + 1}`}
                                onError={event => {
                                  event.currentTarget.src =
                                    "https://via.placeholder.com/100x100?text=URL+inválida"
                                }}
                              />
                            </div>

                            <div className="product-image-admin-input">
                              <label>
                                Imagen {imageIndex + 1}

                                {imageIndex === 0 && (
                                  <span className="product-image-main-badge">
                                    Principal
                                  </span>
                                )}
                              </label>

                              <input
                                type="text"
                                value={image}
                                placeholder="https://..."
                                onChange={event =>
                                  handleImageChange(
                                    product.id,
                                    imageIndex,
                                    event.target.value
                                  )
                                }
                              />
                            </div>

                            <button
                              type="button"
                              className="product-image-remove"
                              title="Eliminar imagen"
                              onClick={() =>
                                handleRemoveImage(
                                  product.id,
                                  imageIndex
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      className="product-add-image"
                      onClick={() =>
                        handleAddImage(product.id)
                      }
                    >
                      ＋ Agregar otra imagen
                    </button>
                  </section>

                  {/* CARACTERÍSTICAS */}
                  {product.attributes?.length > 0 && (
                    <section className="product-admin-attributes product-field-full">
                      <div className="product-admin-section-title">
                        <div>
                          <h4>
                            Características y opciones
                          </h4>
                          <p>
                            Datos adicionales configurados
                            para este producto.
                          </p>
                        </div>

                        <span>
                          {product.attributes.length}{" "}
                          {product.attributes.length === 1
                            ? "característica"
                            : "características"}
                        </span>
                      </div>

                      <div className="product-admin-attributes-list">
                        {product.attributes.map(
                          (attribute, attributeIndex) => (
                            <div
                              key={attributeIndex}
                              className="product-admin-attribute"
                            >
                              <div className="product-admin-attribute-header">
                                <div>
                                  <span>
                                    Característica{" "}
                                    {attributeIndex + 1}
                                  </span>

                                  <strong>
                                    {attribute.name ||
                                      "Sin nombre"}
                                  </strong>
                                </div>

                                <button
                                  type="button"
                                  className="product-admin-attribute-remove"
                                  title="Eliminar característica"
                                  onClick={() =>
                                    handleRemoveAttribute(
                                      product.id,
                                      attributeIndex
                                    )
                                  }
                                >
                                  ×
                                </button>
                              </div>

                              <div className="product-admin-attribute-grid">
                                <div className="product-admin-attribute-type">
                                  <label>Tipo</label>

                                  <select
                                    value={
                                      attribute.type ||
                                      "info"
                                    }
                                    onChange={event =>
                                      handleAttributeChange(
                                        product.id,
                                        attributeIndex,
                                        "type",
                                        event.target.value
                                      )
                                    }
                                  >
                                    <option value="info">
                                      Información
                                    </option>

                                    <option value="select">
                                      El cliente debe elegir
                                    </option>
                                  </select>
                                </div>

                                {attribute.type !== "select" && (
                                  <div className="product-admin-attribute-value">
                                    <label>Valor</label>

                                    <input
                                      type="text"
                                      value={
                                        attribute.value || ""
                                      }
                                      onChange={event =>
                                        handleAttributeChange(
                                          product.id,
                                          attributeIndex,
                                          "value",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </div>
                                )}
                              </div>

                              {attribute.type === "select" && (
                                <div className="product-admin-options">
                                  <label>
                                    Opciones disponibles
                                  </label>

                                  <div className="product-admin-options-list">
                                    {(attribute.options || []).map(
                                      (option, optionIndex) => (
                                        <div
                                          key={optionIndex}
                                          className="product-admin-option-row"
                                        >
                                          <span>
                                            {optionIndex + 1}
                                          </span>

                                          <input
                                            type="text"
                                            value={option}
                                            placeholder="Escribí una opción"
                                            onChange={event =>
                                              handleOptionChange(
                                                product.id,
                                                attributeIndex,
                                                optionIndex,
                                                event.target.value
                                              )
                                            }
                                          />

                                          <button
                                            type="button"
                                            title="Eliminar opción"
                                            onClick={() =>
                                              handleRemoveOption(
                                                product.id,
                                                attributeIndex,
                                                optionIndex
                                              )
                                            }
                                          >
                                            ×
                                          </button>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    className="product-admin-add-option"
                                    onClick={() =>
                                      handleAddOption(
                                        product.id,
                                        attributeIndex
                                      )
                                    }
                                  >
                                    ＋ Agregar opción
                                  </button>

                                  <label className="product-admin-required">
                                    <input
                                      type="checkbox"
                                      checked={
                                        attribute.required !== false
                                      }
                                      onChange={event =>
                                        handleAttributeChange(
                                          product.id,
                                          attributeIndex,
                                          "required",
                                          event.target.checked
                                        )
                                      }
                                    />

                                    <span>
                                      El cliente debe elegir
                                      una opción
                                    </span>
                                  </label>
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </section>
                  )}

                  {/* ESTADO */}
                  <div className="product-field product-status-field">
                    <label>Estado</label>

                    <label className="product-active">
                      <input
                        type="checkbox"
                        checked={
                          product.active !== false
                        }
                        onChange={event =>
                          handleChange(
                            product.id,
                            "active",
                            event.target.checked
                          )
                        }
                      />

                      <span>
                        {product.active !== false
                          ? "Producto activo"
                          : "Producto inactivo"}
                      </span>
                    </label>
                  </div>

                  {/* ACCIONES */}
                  <div className="product-admin-actions">
                    <button
                      type="button"
                      className={`product-update ${
                        updated[product.id]
                          ? "product-updated"
                          : ""
                      }`}
                      disabled={
                        Boolean(updating[product.id])
                      }
                      onClick={() =>
                        handleUpdate(product)
                      }
                    >
                      {updating[product.id]
                        ? "⏳ Actualizando..."
                        : updated[product.id]
                          ? "✓ Actualizado"
                          : "Guardar cambios"}
                    </button>

                    <button
                      type="button"
                      className="product-delete"
                      onClick={() =>
                        handleDelete(product.id)
                      }
                    >
                      🗑 Eliminar
                    </button>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>

      {/* PAGINACIÓN */}
      {!loading &&
        !loadError &&
        (products.length > 0 || currentPage > 1) && (
          <nav
            className="products-pagination"
            aria-label="Paginación de productos"
          >
            <button
              type="button"
              className="pagination-button"
              disabled={
                currentPage === 1 || loading
              }
              onClick={handlePreviousPage}
            >
              ← Anterior
            </button>

            <div className="pagination-current">
              <span>Página</span>
              <strong>{currentPage}</strong>
            </div>

            <button
              type="button"
              className="pagination-button"
              disabled={
                !hasNextPage || loading
              }
              onClick={handleNextPage}
            >
              Siguiente →
            </button>
          </nav>
        )}
    </div>
  )
}

export default ProductsAdmin