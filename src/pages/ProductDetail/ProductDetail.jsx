import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from "firebase/firestore"

import { toast } from "react-toastify"

import { db } from "../../services/firebase"
import { useCart } from "../../hooks/useCart"
import ProductCard from "../../components/ProductCard/ProductCard"

import {
  formatMoney,
  getSelectableAttributes,
  getStock,
  validateSelections
} from "../../utils/cartUtils"

import "./ProductDetail.css"
import "./ProductPurchase.css"

// ==============================
// HELPERS
// ==============================

function getImages(product) {
  const images = Array.isArray(product?.images)
    ? product.images.filter(
        image =>
          typeof image === "string" &&
          image.trim()
      )
    : []

  if (images.length > 0) return images

  return product?.image ? [product.image] : []
}

function getDescription(description) {
  if (Array.isArray(description)) {
    return description
      .map(String)
      .map(text => text.trim())
      .filter(Boolean)
  }

  if (typeof description !== "string") return []

  const text = description.trim()

  if (!text) return []

  try {
    const parsed = JSON.parse(text)

    if (Array.isArray(parsed)) {
      return parsed
        .map(String)
        .map(item => item.trim())
        .filter(Boolean)
    }
  } catch {
    // La descripción también puede ser texto normal.
  }

  return text
    .split(/\.(?=\s|$)/)
    .map(item => item.trim())
    .filter(Boolean)
}

function getOptions(attribute) {
  if (!Array.isArray(attribute?.options)) return []

  return [
    ...new Set(
      attribute.options.filter(
        option =>
          typeof option === "string" &&
          option.trim()
      )
    )
  ]
}

function getQuantityError(
  next,
  current,
  total,
  available
) {
  if (
    !Number.isSafeInteger(next) ||
    next < 0
  ) {
    return "Ingresá una cantidad válida."
  }

  // Permite reducir cantidades aunque el stock haya bajado.
  if (
    next > current &&
    total - current + next > available
  ) {
    return "Stock insuficiente."
  }

  return ""
}

// ==============================
// CONTROL DE CANTIDAD
// ==============================

function QuantityControl({
  value,
  onChange,
  available,
  total,
  label
}) {
  const remaining = Math.max(0, available - total)

  return (
    <div
      className="purchase-quantity-control"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={`Reducir ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>

      <input
        type="number"
        inputMode="numeric"
        min="0"
        max={value + remaining}
        step="1"
        value={value}
        aria-label={label}
        onChange={event =>
          onChange(Number(event.target.value))
        }
      />

      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        disabled={remaining <= 0}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

// ==============================
// DETALLE
// ==============================

function ProductDetail() {
  const { id } = useParams()

  // Reinicia el detalle al navegar a otro producto.
  return <ProductDetailContent key={id} id={id} />
}

function ProductDetailContent({ id }) {
  const { cart, addItemsToCart } = useCart()

  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedImage, setSelectedImage] = useState(0)
  const [openModal, setOpenModal] = useState(false)

  /*
   * Cada fila guarda una combinación y su cantidad.
   *
   * Un solo atributo:
   * Color Negro: 2
   * Color Verde: 1
   *
   * Varios atributos:
   * Negro / M: 2
   * Verde / L: 1
   */
  const [rows, setRows] = useState([
    {
      id: 0,
      quantity: 0,
      selectedAttributes: {}
    }
  ])

  const nextRowId = useRef(1)

  // ==============================
  // CARGA DEL PRODUCTO
  // ==============================

  useEffect(() => {
    let cancelled = false

    async function loadProduct() {
      try {
        const snapshot = await getDoc(
          doc(db, "products", id)
        )

        if (cancelled) return

        if (
          !snapshot.exists() ||
          snapshot.data().active === false
        ) {
          return
        }

        const data = {
          ...snapshot.data(),
          id: snapshot.id
        }

        const hasOptions =
          getSelectableAttributes(data).length > 0

        setProduct(data)

        setRows([
          {
            id: 0,
            quantity:
              !hasOptions && getStock(data) > 0
                ? 1
                : 0,
            selectedAttributes: {}
          }
        ])

        if (data.category) {
          try {
            const relatedQuery = query(
              collection(db, "products"),
              where("category", "==", data.category),
              limit(12)
            )

            const relatedSnapshot = await getDocs(
              relatedQuery
            )

            if (!cancelled) {
              setRelated(
                relatedSnapshot.docs
                  .map(document => ({
                    ...document.data(),
                    id: document.id
                  }))
                  .filter(
                    item =>
                      item.id !== data.id &&
                      item.active !== false
                  )
                  .slice(0, 4)
              )
            }
          } catch (relatedError) {
            console.error(
              "No se pudieron cargar los relacionados:",
              relatedError
            )
          }
        }
      } catch (loadError) {
        console.error(
          "Error al cargar producto:",
          loadError
        )

        if (!cancelled) {
          setError(
            "No pudimos cargar el producto. Intentá nuevamente."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProduct()

    return () => {
      cancelled = true
    }
  }, [id])

  // ==============================
  // GALERÍA Y TECLADO
  // ==============================

  const images = getImages(product)

  useEffect(() => {
    if (!openModal) return

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenModal(false)
      }

      if (
        images.length > 1 &&
        event.key === "ArrowRight"
      ) {
        setSelectedImage(
          previous =>
            (previous + 1) % images.length
        )
      }

      if (
        images.length > 1 &&
        event.key === "ArrowLeft"
      ) {
        setSelectedImage(
          previous =>
            (previous - 1 + images.length) %
            images.length
        )
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      )
    }
  }, [openModal, images.length])

  // ==============================
  // OPCIONES, CANTIDADES Y STOCK
  // ==============================

  const selectableAttributes =
    getSelectableAttributes(product)

  const alreadyInCart = cart
    .filter(
      item =>
        (item.productId || item.id) === product?.id
    )
    .reduce(
      (total, item) => total + item.quantity,
      0
    )

  const available = Math.max(
    0,
    getStock(product) - alreadyInCart
  )

  const totalQuantity = rows.reduce(
    (total, row) => total + row.quantity,
    0
  )

  const subtotal =
    Number(product?.price || 0) * totalQuantity

  function canChangeQuantity(
    nextQuantity,
    currentQuantity
  ) {
    const message = getQuantityError(
      nextQuantity,
      currentQuantity,
      totalQuantity,
      available
    )

    if (!message) return true

    if (message === "Stock insuficiente.") {
      toast.warning(
        `Podés agregar hasta ${available} unidades de este producto, sumando todas sus opciones.`
      )
    } else {
      toast.warning(message)
    }

    return false
  }

  function changeRowQuantity(
    rowId,
    nextQuantity
  ) {
    const row = rows.find(
      item => item.id === rowId
    )

    if (!row) return

    if (
      !canChangeQuantity(
        nextQuantity,
        row.quantity
      )
    ) {
      return
    }

    setRows(
      rows.map(item =>
        item.id === rowId
          ? {
              ...item,
              quantity: nextQuantity
            }
          : item
      )
    )
  }

  /*
   * Para productos con una sola característica:
   * cada alternativa tiene su contador.
   *
   * option === null representa "Sin especificar"
   * y solo se muestra si el atributo es opcional.
   */
  function changeSingleOptionQuantity(
    attribute,
    option,
    nextQuantity
  ) {
    const existing = rows.find(row =>
      option === null
        ? !row.selectedAttributes[attribute.name]
        : row.selectedAttributes[attribute.name] ===
          option
    )

    if (existing) {
      changeRowQuantity(
        existing.id,
        nextQuantity
      )
      return
    }

    if (
      !canChangeQuantity(nextQuantity, 0) ||
      nextQuantity === 0
    ) {
      return
    }

    setRows([
      ...rows,
      {
        id: nextRowId.current++,
        quantity: nextQuantity,
        selectedAttributes:
          option === null
            ? {}
            : {
                [attribute.name]: option
              }
      }
    ])
  }

  function addCombination() {
    if (available <= 0) return

    setRows([
      ...rows,
      {
        id: nextRowId.current++,
        quantity: 0,
        selectedAttributes: {}
      }
    ])
  }

  function removeCombination(rowId) {
    const remaining = rows.filter(
      row => row.id !== rowId
    )

    if (remaining.length > 0) {
      setRows(remaining)
      return
    }

    setRows([
      {
        id: nextRowId.current++,
        quantity: 0,
        selectedAttributes: {}
      }
    ])
  }

  function changeAttribute(
    rowId,
    attributeName,
    option,
    required
  ) {
    setRows(previous =>
      previous.map(row => {
        if (row.id !== rowId) return row

        const selectedAttributes = {
          ...row.selectedAttributes
        }

        if (
          !required &&
          selectedAttributes[attributeName] ===
            option
        ) {
          delete selectedAttributes[attributeName]
        } else {
          selectedAttributes[attributeName] =
            option
        }

        return {
          ...row,
          selectedAttributes
        }
      })
    )
  }

  // ==============================
  // AGREGAR TODO AL CARRITO
  // ==============================

  function handleAdd() {
    if (
      !product ||
      product.active === false ||
      available <= 0
    ) {
      return
    }

    if (totalQuantity <= 0) {
      toast.warning(
        "Elegí la cantidad de al menos una opción."
      )
      return
    }

    if (totalQuantity > available) {
      toast.warning(
        `Podés agregar hasta ${available} unidades más. Revisá las cantidades.`
      )
      return
    }

    try {
      // Las opciones con cantidad cero no se agregan.
      const activeRows = rows.filter(
        row => row.quantity > 0
      )

      const additions = activeRows.map(row => {
        let selectedAttributes

        try {
          selectedAttributes = validateSelections(
            product,
            row.selectedAttributes
          )
        } catch (selectionError) {
          const rowNumber =
            rows.findIndex(
              item => item.id === row.id
            ) + 1

          const prefix =
            selectableAttributes.length > 1
              ? `Combinación ${rowNumber}: `
              : ""

          throw new Error(
            prefix + selectionError.message
          )
        }

        return {
          product: {
            ...product,
            selectedAttributes
          },
          quantity: row.quantity
        }
      })

      const result = addItemsToCart(additions)

      if (!result.ok) {
        toast.warning(result.message)
        return
      }

      toast.success(
        `${totalQuantity} ${
          totalQuantity === 1
            ? "unidad agregada"
            : "unidades agregadas"
        } al carrito 🛒`
      )

      const remainingStock =
        available - totalQuantity

      // Reiniciamos el selector después de agregar.
      setRows([
        {
          id: nextRowId.current++,
          quantity:
            selectableAttributes.length === 0 &&
            remainingStock > 0
              ? 1
              : 0,
          selectedAttributes: {}
        }
      ])
    } catch (selectionError) {
      toast.warning(selectionError.message)
    }
  }

  // ==============================
  // ESTADOS DE CARGA
  // ==============================

  if (loading) {
    return (
      <div className="product-detail-loading container">
        <div className="product-loading-spinner">
          ⏳
        </div>
        <p>Cargando producto...</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="product-detail-empty container">
        <span>📦</span>

        <h2>
          {error || "Producto no encontrado"}
        </h2>

        <Link to="/">
          Volver al inicio
        </Link>
      </div>
    )
  }

  // ==============================
  // DATOS PARA LA VISTA
  // ==============================

  const stock = getStock(product)

  const isAvailable =
    product.active !== false &&
    stock > 0

  const informativeAttributes =
    Array.isArray(product.attributes)
      ? product.attributes.filter(
          attribute =>
            attribute &&
            attribute.type !== "select"
        )
      : []

  const descriptionList = getDescription(
    product.description
  )

  const currentImage =
    images[selectedImage] ||
    images[0] ||
    ""

  const singleAttribute =
    selectableAttributes.length === 1
      ? selectableAttributes[0]
      : null

  const canAdd =
    isAvailable &&
    available > 0 &&
    totalQuantity > 0 &&
    totalQuantity <= available

  const noOptions = selectableAttributes.length === 0

  return (
    <main className="product-detail container">
      <nav
        className="product-breadcrumb"
        aria-label="Navegación"
      >
        <Link to="/">Inicio</Link>
        <span>›</span>

        {product.category && (
          <>
            <Link
              to={`/categoria/${product.category}`}
            >
              {product.category}
            </Link>
            <span>›</span>
          </>
        )}

        <strong>{product.name}</strong>
      </nav>

      <section className="product-detail-card">
        {/* GALERÍA */}
        <div className="product-gallery">
          <div className="product-gallery-main">
            {currentImage ? (
              <img
                src={currentImage}
                alt={product.name}
                className="product-gallery-main-image"
                onClick={() =>
                  setOpenModal(true)
                }
              />
            ) : (
              <div className="product-gallery-placeholder">
                <span>📷</span>
                <p>Sin imagen disponible</p>
              </div>
            )}

            {images.length > 1 && (
              <div className="product-gallery-counter">
                {selectedImage + 1} / {images.length}
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="product-gallery-thumbnails">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className={`product-gallery-thumbnail ${
                    selectedImage === index
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedImage(index)
                  }
                  aria-label={`Ver imagen ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          )}

          {images.length > 0 && (
            <p className="product-gallery-hint">
              🔍 Hacé clic en la imagen para ampliar
            </p>
          )}
        </div>

        {/* INFORMACIÓN */}
        <div className="product-detail-info">
          {product.category && (
            <span className="product-detail-category">
              {product.category}
            </span>
          )}

          <h1>{product.name}</h1>

          <div className="product-price-block">
            <span className="product-detail-price">
              {formatMoney(product.price)}
            </span>
          </div>

          {descriptionList.length > 0 && (
            <div className="product-detail-description">
              <h2>Descripción</h2>

              <div className="description-content">
                {descriptionList.map((text, index) => (
                  <p key={index}>{text}</p>
                ))}
              </div>
            </div>
          )}

          {informativeAttributes.length > 0 && (
            <section className="product-detail-attributes informative">
              <h2>Características</h2>

              <div className="product-attributes-list">
                {informativeAttributes.map(
                  (attribute, index) => (
                    <div
                      key={`${attribute.name}-${index}`}
                      className="product-detail-attribute"
                    >
                      <div className="product-attribute-header">
                        <span>{attribute.name}</span>
                      </div>

                      <p className="product-attribute-value">
                        {attribute.value || "—"}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

          {/* SELECTOR DE COMPRA */}
          <section
            className="purchase-builder"
            aria-labelledby="purchase-title"
          >
            <div className="purchase-heading">
              <h2 id="purchase-title">
                {noOptions
                  ? "Elegí la cantidad"
                  : "Elegí tus opciones"}
              </h2>

              <p>
                {noOptions
                  ? "Indicá cuántas unidades querés."
                  : "Indicá cuántas unidades querés de cada opción."}
              </p>
            </div>

            {/* PRODUCTOS SIN OPCIONES */}
            {noOptions && (
              <div className="purchase-simple-row">
                <span>Cantidad</span>

                <QuantityControl
                  value={rows[0]?.quantity || 0}
                  available={available}
                  total={totalQuantity}
                  label="Cantidad del producto"
                  onChange={nextQuantity =>
                    changeRowQuantity(
                      rows[0].id,
                      nextQuantity
                    )
                  }
                />
              </div>
            )}

            {/* UNA SOLA CARACTERÍSTICA */}
            {singleAttribute && (
              <div className="purchase-options-section">
                <div className="purchase-section-heading">
                  <h3>
                    {singleAttribute.name}
                  </h3>

                  <span>
                    Cantidad por opción
                  </span>
                </div>

                <div className="purchase-options-list">
                  {getOptions(singleAttribute).map(
                    option => {
                      const selectedRow = rows.find(
                        row =>
                          row.selectedAttributes[
                            singleAttribute.name
                          ] === option
                      )

                      const count =
                        selectedRow?.quantity || 0

                      return (
                        <div
                          key={option}
                          className={`purchase-option-row ${
                            count > 0
                              ? "is-selected"
                              : ""
                          }`}
                        >
                          <div className="purchase-option-info">
                            <strong>{option}</strong>

                            {count > 0 && (
                              <span>
                                {count}{" "}
                                {count === 1
                                  ? "unidad"
                                  : "unidades"}
                              </span>
                            )}
                          </div>

                          <QuantityControl
                            value={count}
                            available={available}
                            total={totalQuantity}
                            label={`Cantidad de ${option}`}
                            onChange={nextQuantity =>
                              changeSingleOptionQuantity(
                                singleAttribute,
                                option,
                                nextQuantity
                              )
                            }
                          />
                        </div>
                      )
                    }
                  )}

                  {/* OPCIÓN SIN ELECCIÓN, SI ES OPCIONAL */}
                  {singleAttribute.required === false &&
                    (() => {
                      const unspecified = rows.find(
                        row =>
                          !row.selectedAttributes[
                            singleAttribute.name
                          ]
                      )

                      const count =
                        unspecified?.quantity || 0

                      return (
                        <div
                          className={`purchase-option-row ${
                            count > 0
                              ? "is-selected"
                              : ""
                          }`}
                        >
                          <div className="purchase-option-info">
                            <strong>
                              Sin especificar
                            </strong>
                            <span>
                              {singleAttribute.name} opcional
                            </span>
                          </div>

                          <QuantityControl
                            value={count}
                            available={available}
                            total={totalQuantity}
                            label="Cantidad sin especificar opción"
                            onChange={nextQuantity =>
                              changeSingleOptionQuantity(
                                singleAttribute,
                                null,
                                nextQuantity
                              )
                            }
                          />
                        </div>
                      )
                    })()}
                </div>

                {getOptions(singleAttribute).length === 0 &&
                  singleAttribute.required !== false && (
                    <p className="purchase-help">
                      No hay opciones disponibles.
                    </p>
                  )}
              </div>
            )}

            {/* VARIAS CARACTERÍSTICAS */}
            {selectableAttributes.length > 1 && (
              <div className="purchase-options-section">
                <p className="purchase-help">
                  Elegí las opciones de cada combinación
                  e indicá su cantidad.
                </p>

                <div className="purchase-combinations">
                  {rows.map((row, index) => (
                    <div
                      key={row.id}
                      className={`purchase-combination ${
                        row.quantity > 0
                          ? "is-selected"
                          : ""
                      }`}
                    >
                      <div className="purchase-combination-header">
                        <strong>
                          Combinación {index + 1}
                        </strong>

                        {rows.length > 1 && (
                          <button
                            type="button"
                            className="purchase-remove"
                            onClick={() =>
                              removeCombination(row.id)
                            }
                          >
                            Quitar
                          </button>
                        )}
                      </div>

                      {selectableAttributes.map(
                        (attribute, attributeIndex) => {
                          const required =
                            attribute.required !== false

                          const selected =
                            row.selectedAttributes[
                              attribute.name
                            ]

                          const options =
                            getOptions(attribute)

                          return (
                            <div
                              key={`${attribute.name}-${attributeIndex}`}
                              className="purchase-attribute"
                            >
                              <p className="purchase-attribute-label">
                                {attribute.name}

                                <small>
                                  {required
                                    ? "Obligatorio"
                                    : "Opcional"}
                                </small>
                              </p>

                              <div className="purchase-chips">
                                {options.map(option => (
                                  <button
                                    key={option}
                                    type="button"
                                    className={`purchase-chip ${
                                      selected === option
                                        ? "is-selected"
                                        : ""
                                    }`}
                                    aria-pressed={
                                      selected === option
                                    }
                                    onClick={() =>
                                      changeAttribute(
                                        row.id,
                                        attribute.name,
                                        option,
                                        required
                                      )
                                    }
                                  >
                                    {option}
                                    {selected === option
                                      ? " ✓"
                                      : ""}
                                  </button>
                                ))}
                              </div>

                              {options.length === 0 && (
                                <p className="purchase-help">
                                  No hay opciones disponibles.
                                </p>
                              )}
                            </div>
                          )
                        }
                      )}

                      <div className="purchase-combination-quantity">
                        <span>
                          Cantidad de esta combinación
                        </span>

                        <QuantityControl
                          value={row.quantity}
                          available={available}
                          total={totalQuantity}
                          label={`Cantidad de la combinación ${index + 1}`}
                          onChange={nextQuantity =>
                            changeRowQuantity(
                              row.id,
                              nextQuantity
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="purchase-add-combination"
                  disabled={
                    available <= 0 ||
                    rows.length >= available
                  }
                  onClick={addCombination}
                >
                  + Agregar otra combinación
                </button>
              </div>
            )}

            {/* INFORMACIÓN DEL CARRITO */}
            {alreadyInCart > 0 && (
              <p className="purchase-help">
                Ya tenés {alreadyInCart}{" "}
                {alreadyInCart === 1
                  ? "unidad"
                  : "unidades"}{" "}
                de este producto en el carrito.
              </p>
            )}

            {available > 0 && (
              <p className="purchase-help">
                Podés agregar hasta {available}{" "}
                {available === 1
                  ? "unidad más"
                  : "unidades más"}.
              </p>
            )}

            {/* TOTAL AUTOMÁTICO */}
            <div
              className="purchase-summary"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="purchase-summary-quantity">
                <span>Cantidad total</span>

                <strong>
                  {totalQuantity}{" "}
                  {totalQuantity === 1
                    ? "unidad"
                    : "unidades"}
                </strong>
              </div>

              <div className="purchase-subtotal">
                <span>Subtotal</span>

                <strong>
                  {formatMoney(subtotal)}
                </strong>
              </div>
            </div>
          </section>

          {/* DISPONIBILIDAD */}
          <div
            className={`product-detail-stock ${
              isAvailable
                ? "available"
                : "unavailable"
            }`}
          >
            <span className="stock-dot" />

            <span>
              {!isAvailable
                ? "Sin stock"
                : available <= 0
                  ? "Ya agregaste todo el stock disponible"
                  : `Disponible${
                      stock <= 5
                        ? ` · Últimas ${stock} unidades`
                        : ""
                    }`}
            </span>
          </div>

          {/* AGREGAR TODAS LAS OPCIONES */}
          <button
            type="button"
            className="product-detail-add-button"
            disabled={!canAdd}
            onClick={handleAdd}
          >
            {!isAvailable
              ? "Producto sin stock"
              : available <= 0
                ? "Stock máximo en el carrito"
                : totalQuantity <= 0
                  ? "Elegí una cantidad"
                  : totalQuantity > available
                    ? "Revisá las cantidades"
                    : `Agregar ${totalQuantity} ${
                        totalQuantity === 1
                          ? "unidad"
                          : "unidades"
                      } al carrito 🛒`}
          </button>

          <div className="product-detail-benefits">
            <div className="product-benefit">
              <span>🛒</span>

              <div>
                <strong>Compra fácil</strong>
                <p>
                  Elegí tus opciones y agregalas juntas
                  al carrito.
                </p>
              </div>
            </div>

            <div className="product-benefit">
              <span>✓</span>

              <div>
                <strong>Disponibilidad</strong>
                <p>
                  Verificamos el stock al registrar el pedido.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTOS RELACIONADOS */}
      {related.length > 0 && (
        <section className="related-section">
          <div className="related-header">
            <div>
              <span>
                TAMBIÉN TE PUEDE INTERESAR
              </span>

              <h2>Productos relacionados</h2>
            </div>
          </div>

          <div className="products-grid">
            {related.map(item => (
              <ProductCard
                key={item.id}
                product={item}
              />
            ))}
          </div>
        </section>
      )}

      {/* MODAL DE IMAGEN */}
      {openModal && (
        <div
          className="product-image-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Imágenes de ${product.name}`}
          onClick={() => setOpenModal(false)}
        >
          <div
            className="product-image-modal-content"
            onClick={event =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="product-modal-close"
              aria-label="Cerrar"
              onClick={() => setOpenModal(false)}
            >
              ×
            </button>

            {images.length > 1 && (
              <button
                type="button"
                className="product-modal-arrow product-modal-prev"
                aria-label="Imagen anterior"
                onClick={() =>
                  setSelectedImage(
                    previous =>
                      (previous - 1 + images.length) %
                      images.length
                  )
                }
              >
                ‹
              </button>
            )}

            <img
              src={currentImage}
              alt={product.name}
              className="product-modal-image"
            />

            {images.length > 1 && (
              <button
                type="button"
                className="product-modal-arrow product-modal-next"
                aria-label="Imagen siguiente"
                onClick={() =>
                  setSelectedImage(
                    previous =>
                      (previous + 1) %
                      images.length
                  )
                }
              >
                ›
              </button>
            )}

            {images.length > 1 && (
              <div className="product-modal-counter">
                {selectedImage + 1} / {images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default ProductDetail