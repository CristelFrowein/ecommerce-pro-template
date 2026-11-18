import { db } from "./firebase"
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, startAfter, updateDoc, where } from "firebase/firestore"
import { catalogFields, offerInfo, searchWords } from "../utils/commerce"

const products = collection(db, "products")
const pageSize = 24

function mapProducts(snapshot) {
  return snapshot.docs.map(document => ({ ...document.data(), id: document.id }))
}

export async function getHomeProducts() {
  const active = where("active", "==", true)
  const [featured, offers, fallback] = await Promise.all([
    getDocs(query(products, active, where("featured", "==", true), limit(8))),
    getDocs(query(products, active, where("oldPrice", ">", 0), limit(32))),
    getDocs(query(products, active, limit(8)))
  ])
  const featuredRows = mapProducts(featured)
  return {
    featured: featuredRows.length ? featuredRows : mapProducts(fallback),
    offers: mapProducts(offers).filter(item => offerInfo(item).discount > 0).slice(0, 4)
  }
}

export async function getCatalogPage({ category, search, order = "name-asc", cursor }) {
  const keywords = searchWords(search)
  const first = [...keywords].sort((a, b) => b.length - a.length)[0]
  const [field, direction] = order.split("-")
  const result = await getDocs(query(products, where("active", "==", true),
    ...(category ? [where("category", "==", category)] : []),
    ...(first ? [where("searchPrefixes", "array-contains", first.slice(0, 40))] : []),
    orderBy(field === "price" ? "sortPrice" : "sortName", direction),
    ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)))
  const visible = mapProducts(result).filter(product => !keywords.length || keywords.every(word =>
    searchWords([product.name, product.sku, ...(product.variants || []).map(item => item.sku)].join(" "))
      .some(token => token.startsWith(word))))
  return { products: visible, cursor: result.size === pageSize ? result.docs.at(-1) : null }
}

export async function getProduct(id) {
  try {
    const snapshot = await getDoc(doc(db, "products", id))
    if (!snapshot.exists() || snapshot.data().active === false) return null
    return { ...snapshot.data(), id: snapshot.id }
  } catch (error) {
    if (error.code === "permission-denied") return null
    throw error
  }
}

export async function createProduct(product) {
  return (await addDoc(products, { ...product, ...catalogFields(product) })).id
}

export async function updateProduct(id, data) {
  const previous = await getProduct(id)
  await updateDoc(doc(db, "products", id), { ...data, ...catalogFields({ ...previous, ...data }) })
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, "products", id))
}
