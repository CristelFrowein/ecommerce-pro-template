import { useEffect, useState } from "react"

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
import "./ProductsAdmin.css"


/* ========================================
   CONFIGURACIÓN
======================================== */

const PRODUCTS_PER_PAGE = 10


/* ========================================
   PRODUCTS ADMIN
======================================== */

function ProductsAdmin({ onBack }) {

  const [products, setProducts] = useState([])

  /* PAGINACIÓN */
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCursors, setPageCursors] = useState([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(true)

  /* ESTADOS */
  const [updating, setUpdating] = useState({})
  const [updated, setUpdated] = useState({})


  /* ========================================
     CARGAR PRODUCTOS
  ======================================== */

  useEffect(() => {
    loadProducts()
  }, [currentPage])


  async function loadProducts() {

    setLoading(true)

    try {

      const productsRef = collection(db, "products")

      let productsQuery

      if (currentPage === 1) {

        productsQuery = query(
          productsRef,
          limit(PRODUCTS_PER_PAGE)
        )

      } else {

        const previousCursor =
          pageCursors[currentPage - 1]

        productsQuery = query(
          productsRef,
          startAfter(previousCursor),
          limit(PRODUCTS_PER_PAGE)
        )

      }

      const snap = await getDocs(productsQuery)

      const data = snap.docs.map(document => ({
        id: document.id,
        ...document.data()
      }))

      setProducts(data)

      if (snap.docs.length > 0) {

        setPageCursors(prev => {

          const updatedCursors = [...prev]

          updatedCursors[currentPage] =
            snap.docs[snap.docs.length - 1]

          return updatedCursors

        })

      }

      setHasNextPage(
        snap.docs.length === PRODUCTS_PER_PAGE
      )

    } catch (error) {

      console.error(
        "Error al cargar productos:",
        error
      )

    } finally {

      setLoading(false)

    }

  }


  /* ========================================
     CAMBIAR CAMPO SIMPLE
  ======================================== */

  function handleChange(id, field, value) {

    setProducts(prev =>
      prev.map(product =>
        product.id === id
          ? {
              ...product,
              [field]: value
            }
          : product
      )
    )

    setUpdated(prev => ({
      ...prev,
      [id]: false
    }))

  }


  /* ========================================
     OBTENER IMÁGENES
  ======================================== */

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


  /* ========================================
     CAMBIAR IMAGEN
  ======================================== */

  function handleImageChange(
    productId,
    imageIndex,
    value
  ) {

    setProducts(prev =>
      prev.map(product => {

        if (product.id !== productId) {
          return product
        }

        const images =
          getProductImages(product)

        const updatedImages = [...images]

        updatedImages[imageIndex] = value

        return {
          ...product,
          images: updatedImages,
          image: updatedImages[0] || ""
        }

      })
    )

    setUpdated(prev => ({
      ...prev,
      [productId]: false
    }))

  }


  /* ========================================
     AGREGAR IMAGEN
  ======================================== */

  function handleAddImage(productId) {

    setProducts(prev =>
      prev.map(product => {

        if (product.id !== productId) {
          return product
        }

        const images =
          getProductImages(product)

        return {
          ...product,
          images: [
            ...images,
            ""
          ]
        }

      })
    )

    setUpdated(prev => ({
      ...prev,
      [productId]: false
    }))

  }


  /* ========================================
     ELIMINAR IMAGEN
  ======================================== */

  function handleRemoveImage(
    productId,
    imageIndex
  ) {

    setProducts(prev =>
      prev.map(product => {

        if (product.id !== productId) {
          return product
        }

        const images =
          getProductImages(product)

        const updatedImages =
          images.filter(
            (_, index) =>
              index !== imageIndex
          )

        return {
          ...product,
          images: updatedImages,
          image: updatedImages[0] || ""
        }

      })
    )

    setUpdated(prev => ({
      ...prev,
      [productId]: false
    }))

  }


  /* ========================================
     CAMBIAR ATRIBUTO
  ======================================== */

  function handleAttributeChange(
    productId,
    attributeIndex,
    field,
    value
  ) {

    setProducts(prev =>
      prev.map(product => {

        if (product.id !== productId) {
          return product
        }

        const updatedAttributes =
          (product.attributes || []).map(
            (attribute, index) => {

              if (index !== attributeIndex) {
                return attribute
              }

              return {
                ...attribute,
                [field]: value
              }

            }
          )

        return {
          ...product,
          attributes: updatedAttributes
        }

      })
    )

    setUpdated(prev => ({
      ...prev,
      [productId]: false
    }))

  }


  /* ========================================
     CAMBIAR OPCIÓN
  ======================================== */

  function handleOptionChange(
    productId,
    attributeIndex,
    optionIndex,
    value
  ) {

    setProducts(prev =>
      prev.map(product => {

        if (product.id !== productId) {
          return product
        }

        const updatedAttributes =
          (product.attributes || []).map(
            (attribute, index) => {

              if (index !== attributeIndex) {
                return attribute
              }

              const options =
                [...(attribute.options || [])]

              options[optionIndex] = value

              return {
                ...attribute,
                options
              }

            }
          )

        return {
          ...product,
          attributes: updatedAttributes
        }

      })
    )

    setUpdated(prev => ({
      ...prev,
      [productId]: false
    }))

  }


  /* ========================================
     AGREGAR OPCIÓN
  ======================================== */

  function handleAddOption(
    productId,
    attributeIndex
  ) {

    setProducts(prev =>
      prev.map(product => {

        if (product.id !== productId) {
          return product
        }

        const updatedAttributes =
          (product.attributes || []).map(
            (attribute, index) => {

              if (index !== attributeIndex) {
                return attribute
              }

              return {
                ...attribute,
                options: [
                  ...(attribute.options || []),
                  ""
                ]
              }

            }
          )

        return {
          ...product,
          attributes: updatedAttributes
        }

      })
    )

    setUpdated(prev => ({
      ...prev,
      [productId]: false
    }))

  }


  /* ========================================
     ELIMINAR OPCIÓN
  ======================================== */

  function handleRemoveOption(
    productId,
    attributeIndex,
    optionIndex
  ) {

    setProducts(prev =>
      prev.map(product => {

        if (product.id !== productId) {
          return product
        }

        const updatedAttributes =
          (product.attributes || []).map(
            (attribute, index) => {

              if (index !== attributeIndex) {
                return attribute
              }

              return {
                ...attribute,
                options:
                  (attribute.options || [])
                    .filter(
                      (_, option) =>
                        option !== optionIndex
                    )
              }

            }
          )

        return {
          ...product,
          attributes: updatedAttributes
        }

      })
    )

    setUpdated(prev => ({
      ...prev,
      [productId]: false
    }))

  }


  /* ========================================
     ELIMINAR ATRIBUTO
  ======================================== */

  function handleRemoveAttribute(
    productId,
    attributeIndex
  ) {

    setProducts(prev =>
      prev.map(product => {

        if (product.id !== productId) {
          return product
        }

        return {
          ...product,
          attributes:
            (product.attributes || [])
              .filter(
                (_, index) =>
                  index !== attributeIndex
              )
        }

      })
    )

    setUpdated(prev => ({
      ...prev,
      [productId]: false
    }))

  }


  /* ========================================
     ACTUALIZAR PRODUCTO
  ======================================== */

  async function handleUpdate(product) {

    setUpdating(prev => ({
      ...prev,
      [product.id]: true
    }))

    setUpdated(prev => ({
      ...prev,
      [product.id]: false
    }))

    try {

      const images =
        getProductImages(product)
          .map(image =>
            image.trim()
          )
          .filter(Boolean)


      const attributes =
        (product.attributes || [])
          .map(attribute => {

            if (
              attribute.type === "select"
            ) {

              return {
                name:
                  (attribute.name || "")
                    .trim(),

                type: "select",

                options:
                  (attribute.options || [])
                    .map(option =>
                      option.trim()
                    )
                    .filter(Boolean),

                required:
                  attribute.required !== false
              }

            }

            return {
              name:
                (attribute.name || "")
                  .trim(),

              type: "info",

              value:
                (attribute.value || "")
                  .trim()
            }

          })
          .filter(attribute =>
            attribute.name
          )


      await updateDoc(
        doc(
          db,
          "products",
          product.id
        ),
        {
          name:
            (product.name || "")
              .trim(),

          price:
            Number(product.price) || 0,

          category:
            (product.category || "")
              .trim(),

          description:
            (product.description || "")
              .trim(),

          stock:
            Number(product.stock) || 0,

          active:
            product.active !== false,

          image:
            images[0] || "",

          images,

          attributes
        }
      )


      setUpdated(prev => ({
        ...prev,
        [product.id]: true
      }))


      setTimeout(() => {

        setUpdated(prev => ({
          ...prev,
          [product.id]: false
        }))

      }, 2500)


    } catch (error) {

      console.error(
        "Error al actualizar producto:",
        error
      )

      alert(
        "No se pudo actualizar el producto."
      )

    } finally {

      setUpdating(prev => ({
        ...prev,
        [product.id]: false
      }))

    }

  }


  /* ========================================
     ELIMINAR PRODUCTO
  ======================================== */

  async function handleDelete(id) {

    const confirmDelete =
      window.confirm(
        "¿Seguro que querés eliminar este producto?\n\nEsta acción no se puede deshacer."
      )

    if (!confirmDelete) return

    try {

      await deleteDoc(
        doc(
          db,
          "products",
          id
        )
      )

      setProducts(prev =>
        prev.filter(
          product =>
            product.id !== id
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


  /* ========================================
     PAGINACIÓN
  ======================================== */

  function handleNextPage() {

    if (!hasNextPage) return

    setCurrentPage(
      prev => prev + 1
    )

  }


  function handlePreviousPage() {

    if (currentPage === 1) return

    setCurrentPage(
      prev => prev - 1
    )

  }


  /* ========================================
     RENDER
  ======================================== */

  return (

    <div className="products-admin">


      {/* HEADER */}

      <div className="products-admin-header">

        <div className="products-admin-title">

          <h2>
            Productos
          </h2>

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


      {/* LISTA */}

      <div className="products-admin-list">

        {loading ? (

          <div className="products-empty">

            <span>⏳</span>

            <h3>
              Cargando productos...
            </h3>

          </div>

        ) : products.length === 0 ? (

          <div className="products-empty">

            <span>📦</span>

            <h3>
              No hay productos
            </h3>

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


                {/* ========================================
                    COLUMNA VISUAL
                ======================================== */}

                <aside className="product-admin-sidebar">

                  <div className="product-admin-image">

                    <img
                      src={
                        images[0] ||
                        "https://via.placeholder.com/300x300?text=Sin+imagen"
                      }
                      alt={
                        product.name ||
                        "Producto"
                      }
                      onError={e => {

                        e.currentTarget.src =
                          "https://via.placeholder.com/300x300?text=Sin+imagen"

                      }}
                    />

                  </div>

                  <span className="product-admin-id">
                    ID: {product.id}
                  </span>

                </aside>


                {/* ========================================
                    CONTENIDO
                ======================================== */}

                <div className="product-admin-content">


                  {/* CAMPOS PRINCIPALES */}

                  <div className="product-admin-fields">


                    <div className="product-field">

                      <label>
                        Nombre
                      </label>

                      <input
                        type="text"
                        value={
                          product.name || ""
                        }
                        onChange={e =>
                          handleChange(
                            product.id,
                            "name",
                            e.target.value
                          )
                        }
                      />

                    </div>


                    <div className="product-field">

                      <label>
                        Precio
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={
                          product.price ?? ""
                        }
                        onChange={e =>
                          handleChange(
                            product.id,
                            "price",
                            e.target.value
                          )
                        }
                      />

                    </div>


                    <div className="product-field">

                      <label>
                        Categoría
                      </label>

                      <input
                        type="text"
                        value={
                          product.category || ""
                        }
                        onChange={e =>
                          handleChange(
                            product.id,
                            "category",
                            e.target.value
                          )
                        }
                      />

                    </div>


                    <div className="product-field">

                      <label>
                        Stock
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={
                          product.stock ?? 0
                        }
                        onChange={e =>
                          handleChange(
                            product.id,
                            "stock",
                            e.target.value
                          )
                        }
                      />

                    </div>


                    <div className="product-field product-field-full">

                      <label>
                        Descripción
                      </label>

                      <textarea
                        value={
                          product.description || ""
                        }
                        onChange={e =>
                          handleChange(
                            product.id,
                            "description",
                            e.target.value
                          )
                        }
                        rows="5"
                        placeholder="Descripción del producto..."
                      />

                    </div>

                  </div>


                  {/* ========================================
                      GALERÍA
                  ======================================== */}

                  <section className="product-images-admin product-field-full">

                    <div className="product-images-header">

                      <div>

                        <h4>
                          Imágenes del producto
                        </h4>

                        <p>
                          La primera imagen será la principal.
                        </p>

                      </div>

                      <span className="product-images-count">
                        {images.length}
                        {" "}
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
                                alt={`Imagen ${
                                  imageIndex + 1
                                }`}
                                onError={e => {

                                  e.currentTarget.src =
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
                                onChange={e =>
                                  handleImageChange(
                                    product.id,
                                    imageIndex,
                                    e.target.value
                                  )
                                }
                              />

                            </div>


                            <button
                              type="button"
                              className="product-image-remove"
                              onClick={() =>
                                handleRemoveImage(
                                  product.id,
                                  imageIndex
                                )
                              }
                              title="Eliminar imagen"
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
                        handleAddImage(
                          product.id
                        )
                      }
                    >
                      ＋ Agregar otra imagen
                    </button>

                  </section>


                  {/* ========================================
                      CARACTERÍSTICAS
                  ======================================== */}

                  {product.attributes?.length > 0 && (

                    <section className="product-admin-attributes product-field-full">

                      <div className="product-admin-section-title">

                        <div>

                          <h4>
                            Características y opciones
                          </h4>

                          <p>
                            Datos adicionales configurados para este producto.
                          </p>

                        </div>

                        <span>
                          {product.attributes.length}
                          {" "}
                          {product.attributes.length === 1
                            ? "característica"
                            : "características"}
                        </span>

                      </div>


                      <div className="product-admin-attributes-list">

                        {product.attributes.map(
                          (
                            attribute,
                            attributeIndex
                          ) => (

                            <div
                              key={attributeIndex}
                              className="product-admin-attribute"
                            >


                              <div className="product-admin-attribute-header">

                                <div>

                                  <span>
                                    Característica {attributeIndex + 1}
                                  </span>

                                  <strong>
                                    {attribute.name || "Sin nombre"}
                                  </strong>

                                </div>

                                <button
                                  type="button"
                                  className="product-admin-attribute-remove"
                                  onClick={() =>
                                    handleRemoveAttribute(
                                      product.id,
                                      attributeIndex
                                    )
                                  }
                                  title="Eliminar característica"
                                >
                                  ×
                                </button>

                              </div>


                              <div className="product-admin-attribute-grid">

                                <div className="product-admin-attribute-type">

                                  <label>
                                    Tipo
                                  </label>

                                  <select
                                    value={
                                      attribute.type ||
                                      "info"
                                    }
                                    onChange={e =>
                                      handleAttributeChange(
                                        product.id,
                                        attributeIndex,
                                        "type",
                                        e.target.value
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

                                    <label>
                                      Valor
                                    </label>

                                    <input
                                      type="text"
                                      value={
                                        attribute.value ||
                                        ""
                                      }
                                      onChange={e =>
                                        handleAttributeChange(
                                          product.id,
                                          attributeIndex,
                                          "value",
                                          e.target.value
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
                                      (
                                        option,
                                        optionIndex
                                      ) => (

                                        <div
                                          key={optionIndex}
                                          className="product-admin-option-row"
                                        >

                                          <span>
                                            {optionIndex + 1}
                                          </span>

                                          <input
                                            type="text"
                                            value={
                                              option
                                            }
                                            onChange={e =>
                                              handleOptionChange(
                                                product.id,
                                                attributeIndex,
                                                optionIndex,
                                                e.target.value
                                              )
                                            }
                                            placeholder="Escribí una opción"
                                          />

                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveOption(
                                                product.id,
                                                attributeIndex,
                                                optionIndex
                                              )
                                            }
                                            title="Eliminar opción"
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
                                      onChange={e =>
                                        handleAttributeChange(
                                          product.id,
                                          attributeIndex,
                                          "required",
                                          e.target.checked
                                        )
                                      }
                                    />

                                    <span>
                                      El cliente debe elegir una opción
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


                  {/* ========================================
                      ESTADO
                  ======================================== */}

                  <div className="product-field product-status-field">

                    <label>
                      Estado
                    </label>

                    <label className="product-active">

                      <input
                        type="checkbox"
                        checked={
                          product.active !== false
                        }
                        onChange={e =>
                          handleChange(
                            product.id,
                            "active",
                            e.target.checked
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


                  {/* ========================================
                      ACCIONES
                  ======================================== */}

                  <div className="product-admin-actions">

                    <button
                      type="button"
                      className={`product-update ${
                        updated[product.id]
                          ? "product-updated"
                          : ""
                      }`}
                      disabled={
                        updating[product.id]
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
                        handleDelete(
                          product.id
                        )
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


      {/* ========================================
          PAGINACIÓN
      ======================================== */}

      {!loading &&
        products.length > 0 && (

        <nav
          className="products-pagination"
          aria-label="Paginación de productos"
        >

          <button
            type="button"
            className="pagination-button"
            disabled={
              currentPage === 1 ||
              loading
            }
            onClick={
              handlePreviousPage
            }
          >
            ← Anterior
          </button>


          <div className="pagination-current">

            <span>
              Página
            </span>

            <strong>
              {currentPage}
            </strong>

          </div>


          <button
            type="button"
            className="pagination-button"
            disabled={
              !hasNextPage ||
              loading
            }
            onClick={
              handleNextPage
            }
          >
            Siguiente →
          </button>

        </nav>

      )}

    </div>

  )

}


export default ProductsAdmin