export function getStatus(order) {
  if (order.status == null || order.status === "") {
    return "pending"
  }

  return ["pending", "completed", "cancelled"].includes(order.status)
    ? order.status
    : "unknown"
}

export function getDate(value) {
  if (value == null) return null

  try {
    let date

    if (typeof value.toDate === "function") {
      date = value.toDate()
    } else if (value instanceof Date) {
      date = value
    } else if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      date = new Date(
        value.seconds * 1000 +
        (Number(value.nanoseconds) || 0) / 1000000
      )
    } else if (typeof value === "string" || typeof value === "number") {
      date = new Date(value)
    }

    return date instanceof Date && Number.isFinite(date.getTime())
      ? date
      : null
  } catch {
    return null
  }
}