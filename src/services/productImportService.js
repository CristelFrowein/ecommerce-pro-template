import { sameProductValue } from "../utils/commerce"
import { collection, doc, getDocsFromServer, query, runTransaction, where } from "firebase/firestore"

import { db } from "./firebase"
import { importIdentity, productKey } from "../utils/productExcelImport"

export async function getImportProducts(category) {
  const products = query(collection(db, "products"), where("category", "==", category))
  const snapshot = await getDocsFromServer(products)
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
}

async function findProductTarget(transaction, row) {
  if (row.existing) {
    const ref = doc(db, "products", row.existing.id)
    return { ref, snapshot: await transaction.get(ref) }
  }
  const identity = importIdentity(row.product.category, row.product.name)
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity))
  const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("")
  const baseId = `excel_${hash}`

  // El ID original puede seguir ocupado después de renombrar o mover un producto.
  for (let suffix = 0; ; suffix += 1) {
    const ref = doc(db, "products", suffix ? `${baseId}_${suffix}` : baseId)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) return { ref, snapshot }

    const current = snapshot.data()
    if (importIdentity(current.category, current.name) === identity) {
      throw new Error(`Fila ${row.number}. Ese producto ya se importó. Volvé a comparar el archivo.`)
    }
  }
}

export function checkNewProductNames(rows, products) {
  const existing = new Map()
  for (const product of products) {
    const key = productKey(product.name)
    if (!existing.has(key)) existing.set(key, [])
    existing.get(key).push(product.id)
  }
  for (const row of rows) {
    const key = productKey(row.product.name)
    const keepsName = row.existing && key === productKey(row.existing.name)
    if (!keepsName && existing.get(key)?.some(id => id !== row.existing?.id)) {
      throw new Error(`Fila ${row.number}. El nombre ya existe en la categoría. Volvé a comparar el archivo.`)
    }
  }
}

function sameValue(current, previous, field) {
  return sameProductValue(current[field], previous[field])
}

export async function saveImportedProducts(rows, category) {
  const categoryRef = doc(db, "categories", category.id)

  await runTransaction(db, async transaction => {
    const [categoryDoc, ...targets] = await Promise.all([
      transaction.get(categoryRef),
      ...rows.map(row => findProductTarget(transaction, row))
    ])
    if (!categoryDoc.exists() || categoryDoc.data().slug !== category.slug) {
      throw new Error("La categoría ya no está disponible. Volvé a elegirla.")
    }

    targets.forEach(({ ref, snapshot }, index) => {
      const row = rows[index]
      if (!row.existing) {
        transaction.set(ref, row.changes)
        return
      }

      const current = snapshot.data()
      const fields = new Set(["name", "category", "heldUnits", ...Object.keys(row.changes)])
      if (!current || [...fields].some(field => !sameValue(current, row.existing, field))) {
        throw new Error(`Fila ${row.number}. El producto cambió en el catálogo. Volvé a comparar el archivo.`)
      }
      if (current.heldUnits > 0 && Object.hasOwn(row.changes, "variants")) {
        throw new Error(`Fila ${row.number}. Hay unidades reservadas para estas variantes.`)
      }
      transaction.update(ref, row.changes)
    })
  })
}