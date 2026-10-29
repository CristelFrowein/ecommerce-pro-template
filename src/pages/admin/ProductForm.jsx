import { useState } from "react"

import {
  addDoc,
  collection
} from "firebase/firestore"

import { db } from "../../services/firebase"

import {
  useProductCategories
} from "../../hooks/useProductCategories"

import {
  validateProductNumbers
} from "../../utils/productValidation"

import ProductCategorySelect from "./ProductCategorySelect"

import "./ProductForm.css"

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

function ProductForm({ onBack }) {
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

  const [products, setProducts] = useState([
    { ...emptyProduct }
  ])

  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)

  const categoryState = useProductCategories()

  // ==============================
  // PRODUCTOS
  // ==============================

  function handleChange(index, field, value) {
    setProducts(previous =>
      previous.map((product, i) =>
        i === index
          ? { ...product, [field]: value }
          : product
      )
    )

    setUploaded(false)
  }

  function handleAddProduct() {
    setProducts(previous => [
      ...previous,
      {
        ...emptyProduct,
        images: [],
        attributes: []
      }
    ])

    setUploaded(false)
  }

  function handleRemoveProduct(index) {
    if (products.length === 1) return

    setProducts(previous =>
      previous.filter((_, i) => i !== index)
    )

    setUploaded(false)
  }

  // ==============================
  // IMÁGENES
  // ==============================

  function handleAddImage(index) {
    setProducts(previous =>
      previous.map((product, i) =>
        i === index
          ? {
              ...product,
              images: [...product.images, ""]
            }
          : product
      )
    )

    setUploaded(false)
  }

  function handleImageChange(
    productIndex,
    imageIndex,
    value
  ) {
    setProducts(previous =>
      previous.map((product, i) => {
        if (i !== productIndex) return product

        const images = [...product.images]
        images[imageIndex] = value

        return { ...product, images }
      })
    )

    setUploaded(false)
  }

  function handleRemoveImage(
    productIndex,
    imageIndex
  ) {
    setProducts(previous =>
      previous.map((product, i) =>
        i === productIndex
          ? {
              ...product,
              images: product.images.filter(
                (_, index) => index !== imageIndex
              )
            }
          : product
      )
    )

    setUploaded(false)
  }

  // ==============================
  // CARACTERÍSTICAS
  // ==============================

  function handleAddAttribute(index, attributeName) {
    if (!attributeName) return

    setProducts(previous =>
      previous.map((product, i) => {
        if (i !== index) return product

        const alreadyExists = product.attributes.some(
          attribute =>
            attribute.name.toLowerCase() ===
            attributeName.toLowerCase()
        )

        if (alreadyExists) {
          alert("Esta característica ya fue agregada.")
          return product
        }

        return {
          ...product,
          attributes: [
            ...product.attributes,
            {
              name: attributeName,
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

  function handleAddCustomAttribute(index) {
    const name = prompt(
      "Escribí el nombre de la característica.\n" +
      "Ej: Fragancia, Presentación, Conexión..."
    )

    if (!name || !name.trim()) return

    const trimmedName = name.trim()

    setProducts(previous =>
      previous.map((product, i) => {
        if (i !== index) return product

        const alreadyExists = product.attributes.some(
          attribute =>
            attribute.name.toLowerCase() ===
            trimmedName.toLowerCase()
        )

        if (alreadyExists) {
          alert("Esta característica ya fue agregada.")
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

  function handleAttributeChange(
    productIndex,
    attributeIndex,
    field,
    value
  ) {
    setProducts(previous =>
      previous.map((product, i) =>
        i === productIndex
          ? {
              ...product,
              attributes: product.attributes.map(
                (attribute, index) =>
                  index === attributeIndex
                    ? { ...attribute, [field]: value }
                    : attribute
              )
            }
          : product
      )
    )

    setUploaded(false)
  }

  function handleAttributeTypeChange(
    productIndex,
    attributeIndex,
    type
  ) {
    setProducts(previous =>
      previous.map((product, i) => {
        if (i !== productIndex) return product

        const attributes = product.attributes.map(
          (attribute, index) => {
            if (index !== attributeIndex) {
              return attribute
            }

            if (type === "select") {
              return {
                ...attribute,
                type: "select",
                value: "",
                options: attribute.options?.length > 0
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

        return { ...product, attributes }
      })
    )

    setUploaded(false)
  }

  function handleRemoveAttribute(
    productIndex,
    attributeIndex
  ) {
    setProducts(previous =>
      previous.map((product, i) =>
        i === productIndex
          ? {
              ...product,
              attributes: product.attributes.filter(
                (_, index) => index !== attributeIndex
              )
            }
          : product
      )
    )

    setUploaded(false)
  }

  // ==============================
  // OPCIONES
  // ==============================

  function handleAddOption(
    productIndex,
    attributeIndex
  ) {
    setProducts(previous =>
      previous.map((product, i) =>
        i === productIndex
          ? {
              ...product,
              attributes: product.attributes.map(
                (attribute, index) =>
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

    setUploaded(false)
  }

  function handleOptionChange(
    productIndex,
    attributeIndex,
    optionIndex,
    value
  ) {
    setProducts(previous =>
      previous.map((product, i) => {
        if (i !== productIndex) return product

        const attributes = product.attributes.map(
          (attribute, index) => {
            if (index !== attributeIndex) {
              return attribute
            }

            const options = [
              ...(attribute.options || [])
            ]

            options[optionIndex] = value

            return { ...attribute, options }
          }
        )

        return { ...product, attributes }
      })
    )

    setUploaded(false)
  }

  function handleRemoveOption(
    productIndex,
    attributeIndex,
    optionIndex
  ) {
    setProducts(previous =>
      previous.map((product, i) =>
        i === productIndex
          ? {
              ...product,
              attributes: product.attributes.map(
                (attribute, index) =>
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

    setUploaded(false)
  }

  // ==============================
  // GUARDAR PRODUCTOS
  // ==============================

  async function handleSubmit(event) {
    event.preventDefault()

    if (uploading) return

    const invalidProduct = products.some(
      product =>
        !product.name.trim() ||
        !product.category.trim()
    )

    if (invalidProduct) {
      alert(
        "Completá nombre y categoría en todos los productos."
      )
      return
    }

    let validatedProducts

    try {
      validatedProducts = products.map(
        (product, index) => {
          try {
            return {
              ...validateProductNumbers(product),
              category: categoryState.validateCategory(
                product.category
              )
            }
          } catch (error) {
            throw new Error(
              `Producto ${index + 1}: ${error.message}`
            )
          }
        }
      )
    } catch (error) {
      alert(error.message)
      return
    }

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
          const validOptions = (
            attribute.options || []
          )
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
      await Promise.all(
        products.map((product, index) => {
          const attributes = product.attributes.map(
            attribute => {
              if (attribute.type === "select") {
                return {
                  name: attribute.name.trim(),
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
                name: attribute.name.trim(),
                type: "info",
                value: attribute.value.trim()
              }
            }
          )

          const additionalImages = product.images
            .map(image => image.trim())
            .filter(Boolean)

          const mainImage = product.image.trim()

          const images = mainImage
            ? [mainImage, ...additionalImages]
            : additionalImages

          return addDoc(
            collection(db, "products"),
            {
              name: product.name.trim(),
              price: validatedProducts[index].price,
              image: mainImage,
              images,
              category: validatedProducts[index].category,
              description: product.description.trim(),
              stock: validatedProducts[index].stock,
              active: product.active !== false,
              attributes
            }
          )
        })
      )

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

  // ==============================
  // VISTA
  // ==============================

  return (
    <div className="product-form-page">
      <div className="product-form-header">
        <div>
          <h2>Agregar productos</h2>
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

      <form
        className="products-create-form"
        onSubmit={handleSubmit}
      >
        <div className="products-create-list">
          {products.map((product, index) => (
            <article
              key={index}
              className="product-create-card"
            >
              <div className="product-create-header">
                <div>
                  <span className="product-create-number">
                    Producto {index + 1}
                  </span>
                  <h3>Nuevo producto</h3>
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

              <div className="product-create-fields">
                <div className="product-create-field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={product.name}
                    placeholder="Ej: Mouse inalámbrico"
                    onChange={event =>
                      handleChange(
                        index,
                        "name",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="product-create-field">
                  <label>Precio</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.price}
                    placeholder="Ej: 15000"
                    onChange={event =>
                      handleChange(
                        index,
                        "price",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="product-create-field">
                  <label
                    htmlFor={`create-category-${index}`}
                  >
                    Categoría
                  </label>

                  <ProductCategorySelect
                    id={`create-category-${index}`}
                    value={product.category}
                    categoryState={categoryState}
                    disabled={uploading}
                    onChange={value =>
                      handleChange(
                        index,
                        "category",
                        value
                      )
                    }
                  />
                </div>

                <div className="product-create-field">
                  <label>Stock</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={product.stock}
                    placeholder="0"
                    onChange={event =>
                      handleChange(
                        index,
                        "stock",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="product-create-field product-create-field-full">
                  <label>
                    URL de imagen principal
                  </label>

                  <input
                    type="text"
                    value={product.image}
                    placeholder="https://..."
                    onChange={event =>
                      handleChange(
                        index,
                        "image",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="product-create-field product-create-field-full">
                  <label>Imágenes adicionales</label>

                  <p className="product-images-help">
                    Podés agregar todas las fotos que
                    necesites usando sus URLs.
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
                          placeholder={
                            `URL de imagen adicional ${imageIndex + 1}`
                          }
                          onChange={event =>
                            handleImageChange(
                              index,
                              imageIndex,
                              event.target.value
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

                <div className="product-create-field product-create-field-full">
                  <label>Descripción</label>

                  <textarea
                    value={product.description}
                    rows="4"
                    placeholder="Escribí una descripción general del producto..."
                    onChange={event =>
                      handleChange(
                        index,
                        "description",
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>

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

                {product.attributes.length > 0 && (
                  <div className="product-attributes-list">
                    {product.attributes.map(
                      (attribute, attributeIndex) => (
                        <div
                          key={attributeIndex}
                          className="product-attribute-card"
                        >
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

                          <div className="product-attribute-type">
                            <label>
                              Tipo de característica
                            </label>

                            <select
                              value={attribute.type}
                              onChange={event =>
                                handleAttributeTypeChange(
                                  index,
                                  attributeIndex,
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

                          {attribute.type === "info" && (
                            <div className="product-attribute-value">
                              <label>Valor</label>

                              <input
                                type="text"
                                value={attribute.value || ""}
                                placeholder={
                                  attribute.name === "Marca"
                                    ? "Ej: Samsung"
                                    : attribute.name === "Garantía"
                                      ? "Ej: 6 meses"
                                      : "Escribí el valor..."
                                }
                                onChange={event =>
                                  handleAttributeChange(
                                    index,
                                    attributeIndex,
                                    "value",
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          )}

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
                                      onChange={event =>
                                        handleOptionChange(
                                          index,
                                          attributeIndex,
                                          optionIndex,
                                          event.target.value
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
                                  onChange={event =>
                                    handleAttributeChange(
                                      index,
                                      attributeIndex,
                                      "required",
                                      event.target.checked
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

                <div className="product-add-attribute">
                  <select
                    defaultValue=""
                    onChange={event => {
                      const value = event.target.value

                      if (!value) return

                      if (value === "__custom__") {
                        handleAddCustomAttribute(index)
                      } else {
                        handleAddAttribute(index, value)
                      }

                      event.target.value = ""
                    }}
                  >
                    <option value="">
                      ＋ Agregar característica...
                    </option>

                    {predefinedAttributes.map(attribute => (
                      <option
                        key={attribute}
                        value={attribute}
                      >
                        {attribute}
                      </option>
                    ))}

                    <option value="__custom__">
                      ✨ Crear característica personalizada
                    </option>
                  </select>
                </div>
              </div>

              <div className="product-create-field product-status-field">
                <label>Estado</label>

                <label className="product-create-active">
                  <input
                    type="checkbox"
                    checked={product.active !== false}
                    onChange={event =>
                      handleChange(
                        index,
                        "active",
                        event.target.checked
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

              {product.image && (
                <div className="product-create-preview">
                  <span>Vista previa</span>

                  <img
                    src={product.image}
                    alt={product.name || "Vista previa"}
                    onError={event => {
                      event.currentTarget.style.display = "none"
                    }}
                  />
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="products-create-actions">
          <button
            type="button"
            className="product-add-more"
            onClick={handleAddProduct}
            disabled={uploading}
          >
            ＋ Crear otro producto
          </button>

          <button
            type="submit"
            className={`products-upload ${
              uploaded ? "products-uploaded" : ""
            }`}
            disabled={
              uploading ||
              categoryState.loading ||
              Boolean(categoryState.error) ||
              categoryState.categories.length === 0
            }
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