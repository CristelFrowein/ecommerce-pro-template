import { getAdminDb } from "../server/firebaseAdmin.js"
import { catalogFields } from "../src/utils/commerce.js"

const db = getAdminDb()
const products = db.collection("products")
const apply = process.argv.includes("--apply")
let cursor
let total = 0
for (;;) {
  const page = await (cursor ? products.orderBy("__name__").startAfter(cursor).limit(250) : products.orderBy("__name__").limit(250)).get()
  if (page.empty) break
  cursor = page.docs.at(-1)
  if (apply) {
    const writer = db.bulkWriter()
    const writes = page.docs.map(doc => writer.update(doc.ref, catalogFields(doc.data()), { lastUpdateTime: doc.updateTime }))
    await Promise.all([writer.close(), Promise.all(writes)])
  }
  total += page.size
}
console.log(apply ? `${total} productos indexados.` : `${total} productos encontrados. Agregá --apply para indexarlos.`)
