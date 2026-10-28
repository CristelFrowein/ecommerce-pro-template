import { db } from "./firebase"

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore"

export async function getProducts(){

  const ref = collection(db, "products")

  const snapshot = await getDocs(ref)

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

}

export async function getProductsByCategory(category){

  const ref = collection(db,"products")

  const q = query(
    ref,
    where("category","==",category)
  )

  const snapshot = await getDocs(q)

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

}

export async function getProduct(id){

  const ref = doc(db,"products",id)

  const snapshot = await getDoc(ref)

  return {
    id:snapshot.id,
    ...snapshot.data()
  }

}

export async function createProduct(product){

  const ref = collection(db,"products")

  const docRef = await addDoc(ref, product)

  return docRef.id

}

export async function updateProduct(id, data){

  const ref = doc(db,"products",id)

  await updateDoc(ref,data)

}

export async function deleteProduct(id){

  const ref = doc(db,"products",id)

  await deleteDoc(ref)

}