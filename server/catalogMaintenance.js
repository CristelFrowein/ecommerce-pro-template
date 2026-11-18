import { catalogFields } from "../src/utils/commerce.js"

export async function updateCatalogPrices(db, batchSize = 100) {
  const now = Date.now()
  const page = await db.collection("products").where("nextPriceChangeAtMs", ">", 0)
    .where("nextPriceChangeAtMs", "<=", now).limit(batchSize).get()
  if (page.empty) return 0
  const writer = db.bulkWriter()
  const updates = page.docs.map(doc => writer.update(doc.ref, catalogFields(doc.data(), now), { lastUpdateTime: doc.updateTime }))
  const results = await Promise.allSettled(updates)
  await writer.close()
  return results.filter(result => result.status === "fulfilled").length
}
