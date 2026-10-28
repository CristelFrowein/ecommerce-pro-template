import "./ProductDetail.css"

import { useParams, Link } from "react-router-dom"
import { useEffect, useState } from "react"

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  limit
} from "firebase/firestore"

import { db } from "../../services/firebase"

import { useCart } from "../../hooks/useCart"
import { toast } from "react-toastify"
import ProductCard from "../../components/ProductCard/ProductCard"


function ProductDetail() {

  const { id } = useParams()

  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedImage, setSelectedImage] = useState(0)
  const [openModal, setOpenModal] = useState(false)

  // Opciones elegidas por el cliente
  const [selectedAttributes, setSelectedAttributes] = useState({})

  const { addToCart } = useCart()


  /* ========================================
     CARGAR PRODUCTO
  ======================================== */

  useEffect(() => {

    const loadData = async () => {

      try {

        const docRef = doc(
          db,
          "products",
          id
        )

        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {

          const data = {
            id: docSnap.id,
            ...docSnap.data()
          }

          setProduct(data)

          // Reiniciar opciones al cambiar de producto
          setSelectedAttributes({})


          /* ================================
             PRODUCTOS RELACIONADOS
          ================================= */

          if (data.category) {

            const q = query(
              collection(db, "products"),
              where(
                "category",
                "==",
                data.category
              ),
              limit(5)
            )

            const snap = await getDocs(q)

            const rel = snap.docs
              .map(document => ({
                id: document.id,
                ...document.data()
              }))
              .filter(
                product =>
                  product.id !== data.id &&
                  product.active !== false
              )
              .slice(0, 4)

            setRelated(rel)

          }

        }

      } catch (error) {

        console.error(
          "Error al cargar producto:",
          error
        )

      } finally {

        setLoading(false)

      }

    }

    loadData()

  }, [id])


  /* ========================================
     IMÁGENES
  ======================================== */

  const getProductImages = () => {

    if (
      Array.isArray(product?.images) &&
      product.images.length > 0
    ) {

      return product.images.filter(Boolean)

    }

    if (
      product?.image &&
      typeof product.image === "string"
    ) {

      return [product.image]

    }

    return []

  }


  const images = getProductImages()


  /* ========================================
     DESCRIPCIÓN
  ======================================== */

  const getDescription = () => {

    if (!product?.description) {
      return []
    }

    if (
      Array.isArray(product.description)
    ) {

      return product.description
        .map(item => String(item).trim())
        .filter(Boolean)

    }

    if (
      typeof product.description === "string"
    ) {

      const description =
        product.description.trim()

      if (!description) {
        return []
      }


      // Compatibilidad con arrays guardados como JSON

      try {

        const parsed =
          JSON.parse(description)

        if (Array.isArray(parsed)) {

          return parsed
            .map(item =>
              String(item).trim()
            )
            .filter(Boolean)

        }

      } catch {
        // No era JSON
      }


      // Separar por puntos

      const parts =
        description
          .split(/\.(?=\s|$)/)
          .map(item => item.trim())
          .filter(Boolean)


      return parts.length > 1
        ? parts
        : [description]

    }

    return []

  }


  const descriptionList =
    getDescription()


  /* ========================================
     ATRIBUTOS
  ======================================== */

  const attributes =
    Array.isArray(product?.attributes)
      ? product.attributes
      : []


  /*
    Atributos que realmente necesitan
    una elección del cliente.

    Ej:
    Color
    Tamaño
    Modelo
    Capacidad
  */

  const selectableAttributes =
    attributes.filter(
      attribute =>
        attribute?.type === "select" &&
        Array.isArray(attribute?.options) &&
        attribute.options.filter(Boolean).length > 0
    )


  /*
    Atributos solamente informativos.

    Ej:
    Material: Plástico
    Con bluetooth: Sí
    Marca: Samsung
  */

  const informativeAttributes =
    attributes.filter(
      attribute =>
        !(
          attribute?.type === "select" &&
          Array.isArray(attribute?.options) &&
          attribute.options.filter(Boolean).length > 0
        )
    )


  /* ========================================
     SELECCIONAR ATRIBUTO
  ======================================== */

  const handleAttributeSelect = (
    attributeName,
    option
  ) => {

    setSelectedAttributes(prev => ({
      ...prev,
      [attributeName]: option
    }))

  }


  /* ========================================
     VERIFICAR OPCIONES FALTANTES
  ======================================== */

  const getMissingAttributes = () => {

    return selectableAttributes.filter(
      attribute =>
        !selectedAttributes[attribute.name]
    )

  }


  /* ========================================
     AGREGAR AL CARRITO
  ======================================== */

  const handleAdd = () => {

    if (
      !product ||
      Number(product.stock) <= 0
    ) {

      return

    }


    // Verificar que todas las opciones
    // hayan sido seleccionadas

    const missingAttributes =
      getMissingAttributes()


    if (missingAttributes.length > 0) {

      const missingNames =
        missingAttributes
          .map(attribute => attribute.name)
          .join(", ")


      toast.warning(
        `Elegí ${missingNames} antes de agregar el producto 🛒`
      )

      return

    }


    /*
      Creamos una copia del producto.

      Las opciones seleccionadas viajan
      junto con el producto al carrito.

      Ejemplo:

      selectedAttributes: {
        Color: "Negro",
        Tamaño: "Grande"
      }
    */

    const productToCart = {
      ...product,
      selectedAttributes: {
        ...selectedAttributes
      }
    }


    addToCart(productToCart)

    toast.success(
      "Producto agregado al carrito 🛒"
    )

  }


  /* ========================================
     IMAGEN
  ======================================== */

  const handleImageSelect = index => {

    setSelectedImage(index)

  }


  const handleOpenModal = () => {

    if (images.length === 0) {
      return
    }

    setOpenModal(true)

  }


  const handleCloseModal = () => {

    setOpenModal(false)

  }


  /* ========================================
     TECLADO - MODAL
  ======================================== */

  useEffect(() => {

    if (!openModal) {
      return
    }


    const handleKeyDown = event => {

      if (event.key === "Escape") {

        setOpenModal(false)

      }


      if (
        event.key === "ArrowRight" &&
        images.length > 1
      ) {

        setSelectedImage(prev =>
          (prev + 1) % images.length
        )

      }


      if (
        event.key === "ArrowLeft" &&
        images.length > 1
      ) {

        setSelectedImage(prev =>
          prev === 0
            ? images.length - 1
            : prev - 1
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


  /* ========================================
     LOADING
  ======================================== */

  if (loading) {

    return (

      <div className="product-detail-loading container">

        <div className="product-loading-spinner">
          ⏳
        </div>

        <p>
          Cargando producto...
        </p>

      </div>

    )

  }


  /* ========================================
     NO ENCONTRADO
  ======================================== */

  if (!product) {

    return (

      <div className="product-detail-empty container">

        <span>📦</span>

        <h2>
          Producto no encontrado
        </h2>

        <Link to="/">
          Volver al inicio
        </Link>

      </div>

    )

  }


  const currentImage =
    images[selectedImage] || ""


  const stock =
    Number(product.stock) || 0


  const isAvailable =
    product.active !== false &&
    stock > 0


  const missingAttributes =
    getMissingAttributes()


  return (

    <main className="product-detail container">


      {/* ========================================
          BREADCRUMB
      ======================================== */}

      <nav
        className="product-breadcrumb"
        aria-label="Navegación"
      >

        <Link to="/">
          Inicio
        </Link>

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

        <strong>
          {product.name}
        </strong>

      </nav>


      {/* ========================================
          PRODUCTO PRINCIPAL
      ======================================== */}

      <section className="product-detail-card">


        {/* ======================================
            GALERÍA
        ====================================== */}

        <div className="product-gallery">

          <div className="product-gallery-main">

            {currentImage ? (

              <img
                src={currentImage}
                alt={product.name}
                className="product-gallery-main-image"
                onClick={handleOpenModal}
                onError={event => {

                  event.currentTarget.src =
                    "https://via.placeholder.com/600x600?text=Sin+imagen"

                }}
              />

            ) : (

              <div className="product-gallery-placeholder">

                <span>
                  📷
                </span>

                <p>
                  Sin imagen disponible
                </p>

              </div>

            )}


            {images.length > 1 && (

              <div className="product-gallery-counter">

                {selectedImage + 1}
                {" / "}
                {images.length}

              </div>

            )}

          </div>


          {/* MINIATURAS */}

          {images.length > 1 && (

            <div className="product-gallery-thumbnails">

              {images.map(
                (image, index) => (

                  <button
                    key={index}
                    type="button"
                    className={`product-gallery-thumbnail ${
                      selectedImage === index
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      handleImageSelect(index)
                    }
                    aria-label={`Ver imagen ${
                      index + 1
                    }`}
                  >

                    <img
                      src={image}
                      alt={`${product.name} ${
                        index + 1
                      }`}
                      onError={event => {

                        event.currentTarget.src =
                          "https://via.placeholder.com/100x100?text=Imagen"

                      }}
                    />

                  </button>

                )
              )}

            </div>

          )}


          {images.length > 0 && (

            <p className="product-gallery-hint">
              🔍 Hacé clic en la imagen para ampliar
            </p>

          )}

        </div>


        {/* ======================================
            INFORMACIÓN
        ====================================== */}

        <div className="product-detail-info">


          {/* CATEGORÍA */}

          {product.category && (

            <span className="product-detail-category">
              {product.category}
            </span>

          )}


          {/* NOMBRE */}

          <h1>
            {product.name}
          </h1>


          {/* PRECIO */}

          <div className="product-price-block">

            <span className="product-detail-price">

              ${Number(
                product.price || 0
              ).toLocaleString("es-AR")}

            </span>

            <span className="product-detail-installments">
              Hasta 3 cuotas sin interés
            </span>

          </div>


          {/* ==================================
              DESCRIPCIÓN
          ================================== */}

          {descriptionList.length > 0 && (

            <div className="product-detail-description">

              <h2>
                Descripción
              </h2>

              <div className="description-content">

                {descriptionList.map(
                  (item, index) => (

                    <p key={index}>
                      {item}
                    </p>

                  )
                )}

              </div>

            </div>

          )}


          {/* ==================================
              ATRIBUTOS SELECCIONABLES
          ================================== */}

          {selectableAttributes.length > 0 && (

            <section className="product-detail-attributes selectable">

              <div className="attributes-section-title">

                <h2>
                  Elegí tus opciones
                </h2>

                <span>
                  Selección obligatoria
                </span>

              </div>


              <div className="product-attributes-list">

                {selectableAttributes.map(
                  (attribute, index) => {

                    const options =
                      attribute.options
                        .filter(Boolean)

                    const selected =
                      selectedAttributes[
                        attribute.name
                      ]


                    return (

                      <div
                        key={index}
                        className={`product-detail-attribute ${
                          !selected &&
                          missingAttributes.some(
                            item =>
                              item.name ===
                              attribute.name
                          )
                            ? "attribute-missing"
                            : ""
                        }`}
                      >

                        <div className="product-attribute-header">

                          <span>
                            {attribute.name}
                          </span>

                          {selected && (

                            <strong>
                              {selected}
                            </strong>

                          )}

                        </div>


                        <div className="product-attribute-options">

                          {options.map(
                            (
                              option,
                              optionIndex
                            ) => (

                              <button
                                key={optionIndex}
                                type="button"
                                className={`product-attribute-option ${
                                  selected === option
                                    ? "selected"
                                    : ""
                                }`}
                                onClick={() =>
                                  handleAttributeSelect(
                                    attribute.name,
                                    option
                                  )
                                }
                              >

                                {option}

                                {selected ===
                                  option && (
                                  <span className="option-check">
                                    ✓
                                  </span>
                                )}

                              </button>

                            )
                          )}

                        </div>

                      </div>

                    )

                  }
                )}

              </div>

            </section>

          )}


          {/* ==================================
              ATRIBUTOS INFORMATIVOS
          ================================== */}

          {informativeAttributes.length > 0 && (

            <section className="product-detail-attributes informative">

              <h2>
                Características
              </h2>


              <div className="product-attributes-list">

                {informativeAttributes.map(
                  (
                    attribute,
                    index
                  ) => (

                    <div
                      key={index}
                      className="product-detail-attribute"
                    >

                      <div className="product-attribute-header">

                        <span>
                          {attribute.name}
                        </span>

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


          {/* ==================================
              STOCK
          ================================== */}

          <div
            className={`product-detail-stock ${
              isAvailable
                ? "available"
                : "unavailable"
            }`}
          >

            <span className="stock-dot" />

            <span>

              {isAvailable

                ? `Disponible${
                    stock <= 5
                      ? ` · Últimas ${stock} unidades`
                      : ""
                  }`

                : "Sin stock"}

            </span>

          </div>


          {/* ==================================
              ACCIÓN
          ================================== */}

          <button
            type="button"
            className="product-detail-add-button"
            disabled={!isAvailable}
            onClick={handleAdd}
          >

            {isAvailable
              ? "Agregar al carrito 🛒"
              : "Producto sin stock"}

          </button>


          {/* ==================================
              INFO EXTRA
          ================================== */}

          <div className="product-detail-benefits">

            <div className="product-benefit">

              <span>
                🛒
              </span>

              <div>

                <strong>
                  Compra fácil
                </strong>

                <p>
                  Agregá el producto al carrito
                  y realizá tu pedido.
                </p>

              </div>

            </div>


            <div className="product-benefit">

              <span>
                ✓
              </span>

              <div>

                <strong>
                  Producto disponible
                </strong>

                <p>
                  El stock se actualiza
                  automáticamente.
                </p>

              </div>

            </div>

          </div>


        </div>

      </section>


      {/* ========================================
          PRODUCTOS RELACIONADOS
      ======================================== */}

      {related.length > 0 && (

        <section className="related-section">

          <div className="related-header">

            <div>

              <span>
                TAMBIÉN TE PUEDE INTERESAR
              </span>

              <h2>
                Productos relacionados
              </h2>

            </div>

          </div>


          <div className="products-grid">

            {related.map(prod => (

              <ProductCard
                key={prod.id}
                product={prod}
              />

            ))}

          </div>

        </section>

      )}


      {/* ========================================
          MODAL DE IMAGEN
      ======================================== */}

      {openModal && (

        <div
          className="product-image-modal"
          onClick={handleCloseModal}
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
              onClick={handleCloseModal}
              aria-label="Cerrar"
            >
              ×
            </button>


            {images.length > 1 && (

              <button
                type="button"
                className="product-modal-arrow product-modal-prev"
                onClick={() =>
                  setSelectedImage(prev =>
                    prev === 0
                      ? images.length - 1
                      : prev - 1
                  )
                }
                aria-label="Imagen anterior"
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
                onClick={() =>
                  setSelectedImage(prev =>
                    (prev + 1) % images.length
                  )
                }
                aria-label="Imagen siguiente"
              >
                ›
              </button>

            )}


            {images.length > 1 && (

              <div className="product-modal-counter">

                {selectedImage + 1}
                {" / "}
                {images.length}

              </div>

            )}

          </div>

        </div>

      )}

    </main>

  )

}


export default ProductDetail