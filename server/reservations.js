import { FieldValue } from "firebase-admin/firestore"
import { readProducts, writeInventory } from "./inventory.js"

export async function releaseReservation(db, orderRef, reason) {
  return db.runTransaction(async transaction => {
    const order = (await transaction.get(orderRef)).data()
    const reservation = order?.reservation
    if (reservation?.state !== "held") return false
    if (reason === "expired" && reservation.expiresAtMs > Date.now()) return false
    const products = await readProducts(db, transaction, reservation.lines.map(line => line.productId))
    let state = "released"
    try { writeInventory(db, transaction, products, reservation.lines, 1, reservation.counted ? -1 : 0) }
    catch { state = "review" }
    transaction.update(orderRef, {
      reservation: { ...reservation, state }, checkoutState: reason,
      ...(state === "review" || ["pending", "in_process", "authorized"].includes(order.paymentStatus) &&
        order.paymentVerified === true ? { paymentReviewRequired: true } : {}),
      updatedAt: FieldValue.serverTimestamp()
    })
    return true
  })
}

export async function sweepReservations(db, size = 20) {
  const expired = await db.collection("orders")
    .where("reservation.state", "==", "held")
    .where("reservation.expiresAtMs", "<=", Date.now()).limit(size).get()
  const results = await Promise.allSettled(expired.docs.map(order => releaseReservation(db, order.ref, "expired")))
  return { released: results.filter(result => result.status === "fulfilled" && result.value).length,
    errors: results.filter(result => result.status === "rejected").length }
}

