import { db } from "./firebase"

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore"

function mapProducts(snapshot) {
  return snapshot.docs.map(document => ({
    ...document.data(),
    id: document.id
  }))
}

export async function getProducts() {
  const snapshot = await getDocs(collection(db, "products"))

  return mapProducts(snapshot).filter(
    product => product.active !== false
  )
}

export async function getProductsByCategory(category) {
  const productsQuery = query(
    collection(db, "products"),
    where("category", "==", category)
  )

  const snapshot = await getDocs(productsQuery)

  return mapProducts(snapshot).filter(
    product => product.active !== false
  )
}

export async function getProduct(id) {
  const snapshot = await getDoc(doc(db, "products", id))

  if (!snapshot.exists()) return null

  const product = {
    ...snapshot.data(),
    id: snapshot.id
  }

  return product.active === false ? null : product
}

export async function createProduct(product) {
  const reference = await addDoc(
    collection(db, "products"),
    product
  )

  return reference.id
}

export async function updateProduct(id, data) {
  await updateDoc(doc(db, "products", id), data)
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, "products", id))
}