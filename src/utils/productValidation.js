function readNumber(value, label, integer = false) {
  const validType =
    typeof value === "number" ||
    typeof value === "string"

  if (
    !validType ||
    String(value).trim() === ""
  ) {
    throw new Error(
      `Completá ${label.toLowerCase()}.`
    )
  }

  const number = Number(value)

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    throw new Error(
      `${label} debe ser un número igual o mayor a cero.`
    )
  }

  if (
    integer &&
    !Number.isSafeInteger(number)
  ) {
    throw new Error(
      "El stock debe ser un número entero igual o mayor a cero."
    )
  }

  return number
}

export function validateProductNumbers(product) {
  return {
    price: readNumber(
      product.price,
      "El precio"
    ),

    stock: readNumber(
      product.stock,
      "El stock",
      true
    )
  }
}