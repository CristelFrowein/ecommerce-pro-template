import { useState } from "react"
import { addDoc, collection } from "firebase/firestore"
import { db } from "../../services/firebase"
import "./ProductForm.css"


/* ========================================
   CARACTERÍSTICAS PREARMADAS
======================================== */

const predefinedAttributes = [
  "Marca",
  "Modelo",
  "Material",
  "Garantía",
  "Medidas",
  "Peso",
  "Capacidad",
  "Compatibilidad",
  "Potencia",
  "Voltaje",
  "Color",
  "Talle",
  "Tipo"
]


/* ========================================
   PRODUCT FORM
======================================== */

function ProductForm({ onBack }) {


  /* ========================================
     PRODUCTO VACÍO
  ======================================== */

  const emptyProduct = {
    name: "",
    price: "",
    image: "",
    images: [],
    category: "",
    description: "",
    stock: 0,
    active: true,
    attributes: []
  }


  /* ========================================
     PRODUCTOS
  ======================================== */

  const [products, setProducts] = useState([
    { ...emptyProduct }
  ])


  /* ========================================
     ESTADOS DE SUBIDA
  ======================================== */

  const [uploading, setUploading] = useState(false)

  const [uploaded, setUploaded] = useState(false)


  /* ========================================
     CAMBIAR PRODUCTO
  ======================================== */

  function handleChange(index, field, value) {

    setProducts(prev =>
      prev.map((product, i) =>
        i === index
          ? {
              ...product,
              [field]: value
            }
          : product
      )
    )

    setUploaded(false)
  }


  /* ========================================
     CREAR OTRO PRODUCTO
  ======================================== */

  function handleAddProduct() {

    setProducts(prev => [
      ...prev,
      {
        ...emptyProduct,
        images: [],
        attributes: []
      }
    ])

    setUploaded(false)
  }


  /* ========================================
     ELIMINAR PRODUCTO
  ======================================== */

  function handleRemoveProduct(index) {

    if (products.length === 1) {
      return
    }

    setProducts(prev =>
      prev.filter((_, i) => i !== index)
    )

    setUploaded(false)
  }


  /* ========================================
     AGREGAR IMAGEN
  ======================================== */

  function handleAddImage(index) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== index) {
          return product
        }

        return {
          ...product,

          images: [
            ...product.images,
            ""
          ]
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     CAMBIAR IMAGEN ADICIONAL
  ======================================== */

  function handleImageChange(
    productIndex,
    imageIndex,
    value
  ) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== productIndex) {
          return product
        }

        const updatedImages = [
          ...product.images
        ]

        updatedImages[imageIndex] = value

        return {
          ...product,
          images: updatedImages
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     ELIMINAR IMAGEN ADICIONAL
  ======================================== */

  function handleRemoveImage(
    productIndex,
    imageIndex
  ) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== productIndex) {
          return product
        }

        return {
          ...product,

          images:
            product.images.filter(
              (_, imageIndexToRemove) =>
                imageIndexToRemove !== imageIndex
            )
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     AGREGAR CARACTERÍSTICA
  ======================================== */

  function handleAddAttribute(index, attributeName) {

    if (!attributeName) return

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== index) {
          return product
        }

        const alreadyExists =
          product.attributes.some(
            attribute =>
              attribute.name.toLowerCase() ===
              attributeName.toLowerCase()
          )

        if (alreadyExists) {

          alert(
            "Esta característica ya fue agregada."
          )

          return product
        }

        const newAttribute = {
          name: attributeName,
          type: "info",
          value: "",
          options: [],
          required: false
        }

        return {
          ...product,

          attributes: [
            ...product.attributes,
            newAttribute
          ]
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     AGREGAR CARACTERÍSTICA PERSONALIZADA
  ======================================== */

  function handleAddCustomAttribute(index) {

    const name = prompt(
      "Escribí el nombre de la característica.\nEj: Fragancia, Presentación, Conexión..."
    )

    if (!name || !name.trim()) {
      return
    }

    const trimmedName = name.trim()

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== index) {
          return product
        }

        const alreadyExists =
          product.attributes.some(
            attribute =>
              attribute.name.toLowerCase() ===
              trimmedName.toLowerCase()
          )

        if (alreadyExists) {

          alert(
            "Esta característica ya fue agregada."
          )

          return product
        }

        return {
          ...product,

          attributes: [
            ...product.attributes,
            {
              name: trimmedName,
              type: "info",
              value: "",
              options: [],
              required: false
            }
          ]
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     CAMBIAR CARACTERÍSTICA
  ======================================== */

  function handleAttributeChange(
    productIndex,
    attributeIndex,
    field,
    value
  ) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== productIndex) {
          return product
        }

        const updatedAttributes =
          product.attributes.map(
            (attribute, attrIndex) => {

              if (attrIndex !== attributeIndex) {
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

    setUploaded(false)
  }


  /* ========================================
     CAMBIAR TIPO DE CARACTERÍSTICA
  ======================================== */

  function handleAttributeTypeChange(
    productIndex,
    attributeIndex,
    type
  ) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== productIndex) {
          return product
        }

        const updatedAttributes =
          product.attributes.map(
            (attribute, attrIndex) => {

              if (attrIndex !== attributeIndex) {
                return attribute
              }

              if (type === "select") {

                return {
                  ...attribute,
                  type: "select",
                  value: "",
                  options:
                    attribute.options?.length > 0
                      ? attribute.options
                      : [""],
                  required: true
                }

              }

              return {
                ...attribute,
                type: "info",
                value: "",
                options: [],
                required: false
              }

            }
          )

        return {
          ...product,
          attributes: updatedAttributes
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     ELIMINAR CARACTERÍSTICA
  ======================================== */

  function handleRemoveAttribute(
    productIndex,
    attributeIndex
  ) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== productIndex) {
          return product
        }

        return {
          ...product,

          attributes:
            product.attributes.filter(
              (_, attrIndex) =>
                attrIndex !== attributeIndex
            )
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     AGREGAR OPCIÓN
  ======================================== */

  function handleAddOption(
    productIndex,
    attributeIndex
  ) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== productIndex) {
          return product
        }

        const updatedAttributes =
          product.attributes.map(
            (attribute, attrIndex) => {

              if (attrIndex !== attributeIndex) {
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

    setUploaded(false)
  }


  /* ========================================
     CAMBIAR OPCIÓN
  ======================================== */

  function handleOptionChange(
    productIndex,
    attributeIndex,
    optionIndex,
    value
  ) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== productIndex) {
          return product
        }

        const updatedAttributes =
          product.attributes.map(
            (attribute, attrIndex) => {

              if (attrIndex !== attributeIndex) {
                return attribute
              }

              const updatedOptions =
                [...(attribute.options || [])]

              updatedOptions[optionIndex] = value

              return {
                ...attribute,
                options: updatedOptions
              }

            }
          )

        return {
          ...product,
          attributes: updatedAttributes
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     ELIMINAR OPCIÓN
  ======================================== */

  function handleRemoveOption(
    productIndex,
    attributeIndex,
    optionIndex
  ) {

    setProducts(prev =>
      prev.map((product, i) => {

        if (i !== productIndex) {
          return product
        }

        const updatedAttributes =
          product.attributes.map(
            (attribute, attrIndex) => {

              if (attrIndex !== attributeIndex) {
                return attribute
              }

              const updatedOptions =
                (attribute.options || [])
                  .filter(
                    (_, index) =>
                      index !== optionIndex
                  )

              return {
                ...attribute,
                options: updatedOptions
              }

            }
          )

        return {
          ...product,
          attributes: updatedAttributes
        }

      })
    )

    setUploaded(false)
  }


  /* ========================================
     SUBIR TODOS LOS PRODUCTOS
  ======================================== */

  async function handleSubmit(e) {

    e.preventDefault()

    if (uploading) return


    /* ========================================
       VALIDACIÓN BÁSICA
    ======================================== */

    const invalidProduct = products.some(product => {

      return (
        !product.name.trim() ||
        !product.price ||
        !product.category.trim()
      )

    })


    if (invalidProduct) {

      alert(
        "Completá nombre, precio y categoría en todos los productos."
      )

      return
    }


    /* ========================================
       VALIDAR CARACTERÍSTICAS
    ======================================== */

    for (const product of products) {

      for (const attribute of product.attributes) {

        if (
          attribute.type === "info" &&
          !attribute.value.trim()
        ) {

          alert(
            `Completá el valor de "${attribute.name}" en "${product.name}".`
          )

          return
        }


        if (attribute.type === "select") {

          const validOptions =
            (attribute.options || [])
              .map(option => option.trim())
              .filter(Boolean)

          if (validOptions.length === 0) {

            alert(
              `Agregá al menos una opción para "${attribute.name}" en "${product.name}".`
            )

            return
          }

        }

      }

    }


    setUploading(true)

    setUploaded(false)


    try {

      /* ========================================
         CREAR PRODUCTOS
      ======================================== */

      await Promise.all(

        products.map(product => {

          /*
           * LIMPIAR CARACTERÍSTICAS
           */

          const cleanedAttributes =
            product.attributes.map(attribute => {

              if (attribute.type === "select") {

                return {
                  name: attribute.name.trim(),

                  type: "select",

                  options:
                    (attribute.options || [])
                      .map(option => option.trim())
                      .filter(Boolean),

                  required:
                    attribute.required !== false
                }

              }

              return {
                name: attribute.name.trim(),

                type: "info",

                value:
                  attribute.value.trim()
              }

            })


          /*
           * LIMPIAR IMÁGENES
           *
           * La primera imagen es la principal.
           * Las demás quedan como imágenes adicionales.
           */

          const additionalImages =
            product.images
              .map(image => image.trim())
              .filter(Boolean)


          const allImages =
            product.image.trim()
              ? [
                  product.image.trim(),
                  ...additionalImages
                ]
              : additionalImages


          return addDoc(
            collection(db, "products"),
            {

              name:
                product.name.trim(),

              price:
                Number(product.price),

              /*
               * IMAGEN PRINCIPAL
               */

              image:
                product.image.trim(),

              /*
               * TODAS LAS IMÁGENES
               */

              images:
                allImages,

              category:
                product.category.trim(),

              description:
                product.description.trim(),

              stock:
                Number(product.stock) || 0,

              active:
                product.active !== false,

              /*
               * CARACTERÍSTICAS
               */

              attributes:
                cleanedAttributes

            }

          )

        })

      )


      /* ========================================
         ÉXITO
      ======================================== */

      setUploaded(true)


      setTimeout(() => {

        onBack()

      }, 1200)


    } catch (error) {

      console.error(
        "Error al crear productos:",
        error
      )

      alert(
        "Ocurrió un error al subir los productos. Revisá la consola."
      )

    } finally {

      setUploading(false)

    }

  }


  /* ========================================
     RENDER
  ======================================== */

  return (

    <div className="product-form-page">


      {/* ========================================
          HEADER
      ======================================== */}

      <div className="product-form-header">

        <div>

          <h2>
            Agregar productos
          </h2>

          <p>
            Creá uno o varios productos para tu catálogo
          </p>

        </div>


        <button
          type="button"
          className="product-form-back"
          onClick={onBack}
        >
          ← Volver
        </button>

      </div>


      {/* ========================================
          FORMULARIO
      ======================================== */}

      <form
        className="products-create-form"
        onSubmit={handleSubmit}
      >


        {/* ========================================
            PRODUCTOS
        ======================================== */}

        <div className="products-create-list">


          {products.map((product, index) => (

            <article
              key={index}
              className="product-create-card"
            >


              {/* ========================================
                  CARD HEADER
              ======================================== */}

              <div className="product-create-header">

                <div>

                  <span className="product-create-number">
                    Producto {index + 1}
                  </span>

                  <h3>
                    Nuevo producto
                  </h3>

                </div>


                {products.length > 1 && (

                  <button
                    type="button"
                    className="product-remove"
                    onClick={() =>
                      handleRemoveProduct(index)
                    }
                  >
                    × Quitar
                  </button>

                )}

              </div>


              {/* ========================================
                  CAMPOS
              ======================================== */}

              <div className="product-create-fields">


                {/* NOMBRE */}

                <div className="product-create-field">

                  <label>
                    Nombre
                  </label>

                  <input
                    type="text"
                    value={product.name}
                    placeholder="Ej: Mouse inalámbrico"
                    onChange={e =>
                      handleChange(
                        index,
                        "name",
                        e.target.value
                      )
                    }
                  />

                </div>


                {/* PRECIO */}

                <div className="product-create-field">

                  <label>
                    Precio
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={product.price}
                    placeholder="Ej: 15000"
                    onChange={e =>
                      handleChange(
                        index,
                        "price",
                        e.target.value
                      )
                    }
                  />

                </div>


                {/* CATEGORÍA */}

                <div className="product-create-field">

                  <label>
                    Categoría
                  </label>

                  <input
                    type="text"
                    value={product.category}
                    placeholder="Ej: Mouse"
                    onChange={e =>
                      handleChange(
                        index,
                        "category",
                        e.target.value
                      )
                    }
                  />

                </div>


                {/* STOCK */}

                <div className="product-create-field">

                  <label>
                    Stock
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={product.stock}
                    placeholder="0"
                    onChange={e =>
                      handleChange(
                        index,
                        "stock",
                        e.target.value
                      )
                    }
                  />

                </div>


                {/* ========================================
                    IMAGEN PRINCIPAL
                ======================================== */}

                <div className="product-create-field product-create-field-full">

                  <label>
                    URL de imagen principal
                  </label>

                  <input
                    type="text"
                    value={product.image}
                    placeholder="https://..."
                    onChange={e =>
                      handleChange(
                        index,
                        "image",
                        e.target.value
                      )
                    }
                  />

                </div>


                {/* ========================================
                    IMÁGENES ADICIONALES
                ======================================== */}

                <div className="product-create-field product-create-field-full">

                  <label>
                    Imágenes adicionales
                  </label>

                  <p className="product-images-help">
                    Podés agregar todas las fotos que necesites usando sus URLs.
                  </p>


                  {product.images.map(
                    (image, imageIndex) => (

                      <div
                        key={imageIndex}
                        className="product-image-row"
                      >

                        <input
                          type="text"
                          value={image}
                          placeholder={`URL de imagen adicional ${imageIndex + 1}`}
                          onChange={e =>
                            handleImageChange(
                              index,
                              imageIndex,
                              e.target.value
                            )
                          }
                        />

                        <button
                          type="button"
                          className="product-image-remove"
                          onClick={() =>
                            handleRemoveImage(
                              index,
                              imageIndex
                            )
                          }
                        >
                          ×
                        </button>

                      </div>

                    )
                  )}


                  <button
                    type="button"
                    className="product-add-image"
                    onClick={() =>
                      handleAddImage(index)
                    }
                  >
                    ＋ Agregar otra imagen
                  </button>

                </div>


                {/* DESCRIPCIÓN */}

                <div className="product-create-field product-create-field-full">

                  <label>
                    Descripción
                  </label>

                  <textarea
                    value={product.description}
                    rows="4"
                    placeholder="Escribí una descripción general del producto..."
                    onChange={e =>
                      handleChange(
                        index,
                        "description",
                        e.target.value
                      )
                    }
                  />

                </div>


              </div>


              {/* ========================================
                  CARACTERÍSTICAS
              ======================================== */}

              <div className="product-attributes-section">

                <div className="product-attributes-header">

                  <div>

                    <h4>
                      Características y opciones
                    </h4>

                    <p>
                      Agregá información adicional
                      o datos que el cliente deba elegir.
                    </p>

                  </div>

                </div>


                {/* CARACTERÍSTICAS EXISTENTES */}

                {product.attributes.length > 0 && (

                  <div className="product-attributes-list">

                    {product.attributes.map(
                      (attribute, attributeIndex) => (

                        <div
                          key={attributeIndex}
                          className="product-attribute-card"
                        >


                          {/* HEADER */}

                          <div className="product-attribute-top">

                            <strong>
                              {attribute.name}
                            </strong>

                            <button
                              type="button"
                              className="product-attribute-remove"
                              onClick={() =>
                                handleRemoveAttribute(
                                  index,
                                  attributeIndex
                                )
                              }
                            >
                              ×
                            </button>

                          </div>


                          {/* TIPO */}

                          <div className="product-attribute-type">

                            <label>
                              Tipo de característica
                            </label>

                            <select
                              value={attribute.type}
                              onChange={e =>
                                handleAttributeTypeChange(
                                  index,
                                  attributeIndex,
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


                          {/* INFORMACIÓN */}

                          {attribute.type === "info" && (

                            <div className="product-attribute-value">

                              <label>
                                Valor
                              </label>

                              <input
                                type="text"
                                value={
                                  attribute.value || ""
                                }
                                placeholder={`Ej: ${
                                  attribute.name === "Marca"
                                    ? "Samsung"
                                    : attribute.name === "Garantía"
                                    ? "6 meses"
                                    : "Escribí el valor..."
                                }`}
                                onChange={e =>
                                  handleAttributeChange(
                                    index,
                                    attributeIndex,
                                    "value",
                                    e.target.value
                                  )
                                }
                              />

                            </div>

                          )}


                          {/* OPCIONES */}

                          {attribute.type === "select" && (

                            <div className="product-attribute-options">

                              <label>
                                Opciones disponibles
                              </label>


                              {(attribute.options || []).map(
                                (option, optionIndex) => (

                                  <div
                                    key={optionIndex}
                                    className="product-option-row"
                                  >

                                    <input
                                      type="text"
                                      value={option}
                                      placeholder={
                                        attribute.name === "Color"
                                          ? "Ej: Negro"
                                          : attribute.name === "Talle"
                                          ? "Ej: M"
                                          : "Escribí una opción..."
                                      }
                                      onChange={e =>
                                        handleOptionChange(
                                          index,
                                          attributeIndex,
                                          optionIndex,
                                          e.target.value
                                        )
                                      }
                                    />

                                    <button
                                      type="button"
                                      className="product-option-remove"
                                      onClick={() =>
                                        handleRemoveOption(
                                          index,
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


                              <button
                                type="button"
                                className="product-add-option"
                                onClick={() =>
                                  handleAddOption(
                                    index,
                                    attributeIndex
                                  )
                                }
                              >
                                ＋ Agregar opción
                              </button>


                              <label className="product-required-option">

                                <input
                                  type="checkbox"
                                  checked={
                                    attribute.required !== false
                                  }
                                  onChange={e =>
                                    handleAttributeChange(
                                      index,
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

                )}


                {/* AGREGAR CARACTERÍSTICA */}

                <div className="product-add-attribute">

                  <select
                    defaultValue=""
                    onChange={e => {

                      const value =
                        e.target.value

                      if (!value) return

                      if (value === "__custom__") {

                        handleAddCustomAttribute(index)

                      } else {

                        handleAddAttribute(
                          index,
                          value
                        )

                      }

                      /*
                       * Volvemos el selector
                       * a su estado inicial.
                       */

                      e.target.value = ""

                    }}
                  >

                    <option value="">
                      ＋ Agregar característica...
                    </option>

                    {predefinedAttributes.map(
                      attribute => (

                        <option
                          key={attribute}
                          value={attribute}
                        >
                          {attribute}
                        </option>

                      )
                    )}

                    <option value="__custom__">
                      ✨ Crear característica personalizada
                    </option>

                  </select>

                </div>


              </div>


              {/* ========================================
                  ESTADO
              ======================================== */}

              <div className="product-create-field product-status-field">

                <label>
                  Estado
                </label>

                <label className="product-create-active">

                  <input
                    type="checkbox"
                    checked={
                      product.active !== false
                    }
                    onChange={e =>
                      handleChange(
                        index,
                        "active",
                        e.target.checked
                      )
                    }
                  />

                  <span>
                    {product.active
                      ? "Producto activo"
                      : "Producto inactivo"}
                  </span>

                </label>

              </div>


              {/* ========================================
                  PREVISUALIZACIÓN
              ======================================== */}

              {product.image && (

                <div className="product-create-preview">

                  <span>
                    Vista previa
                  </span>

                  <img
                    src={product.image}
                    alt={
                      product.name ||
                      "Vista previa"
                    }
                    onError={e => {
                      e.currentTarget.style.display =
                        "none"
                    }}
                  />

                </div>

              )}


            </article>

          ))}


        </div>


        {/* ========================================
            ACCIONES
        ======================================== */}

        <div className="products-create-actions">


          {/* CREAR OTRO */}

          <button
            type="button"
            className="product-add-more"
            onClick={handleAddProduct}
            disabled={uploading}
          >
            ＋ Crear otro producto
          </button>


          {/* SUBIR */}

          <button
            type="submit"
            className={`products-upload ${
              uploaded
                ? "products-uploaded"
                : ""
            }`}
            disabled={uploading}
          >

            {uploading
              ? "⏳ Subiendo productos..."
              : uploaded
              ? "✓ Productos subidos"
              : `Subir ${products.length} ${
                  products.length === 1
                    ? "producto"
                    : "productos"
                }`}

          </button>


        </div>


      </form>

    </div>

  )
}


export default ProductForm