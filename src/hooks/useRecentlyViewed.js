import { useSyncExternalStore } from "react"

const STORAGE_KEY = "store-recently-viewed"
const MAX_PRODUCTS = 5

const EMPTY_IDS = Object.freeze([])

let productIds = EMPTY_IDS
let initialized = false

const listeners = new Set()

function validId(id) {
  return (
    typeof id === "string" &&
    id.trim() !== "" &&
    !id.includes("/") &&
    id !== "." &&
    id !== ".."
  )
}

function normalizeIds(value) {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(value.filter(validId))
  ].slice(0, MAX_PRODUCTS)
}

function readStorage() {
  const saved = localStorage.getItem(STORAGE_KEY)

  return saved
    ? normalizeIds(JSON.parse(saved))
    : []
}

function sameIds(first, second) {
  return (
    first.length === second.length &&
    first.every((id, index) => id === second[index])
  )
}

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function initialize() {
  if (
    initialized ||
    typeof window === "undefined"
  ) {
    return
  }

  initialized = true

  try {
    productIds = readStorage()
  } catch {
    productIds = EMPTY_IDS
  }
}

function refreshFromStorage() {
  initialize()

  try {
    const saved = readStorage()

    if (!sameIds(productIds, saved)) {
      productIds = saved
      notify()
    }
  } catch {
    // Conservamos el historial actual si no podemos leerlo.
  }
}

function handleStorage(event) {
  if (
    event.storageArea === window.localStorage &&
    (
      event.key === STORAGE_KEY ||
      event.key === null
    )
  ) {
    refreshFromStorage()
  }
}

function subscribe(listener) {
  initialize()

  const firstSubscriber = listeners.size === 0

  listeners.add(listener)

  if (firstSubscriber) {
    window.addEventListener("storage", handleStorage)
    window.addEventListener("focus", refreshFromStorage)
    refreshFromStorage()
  }

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("focus", refreshFromStorage)
    }
  }
}

function getSnapshot() {
  initialize()
  return productIds
}

function getServerSnapshot() {
  return EMPTY_IDS
}

function saveIds(nextIds) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextIds)
    )

    if (!sameIds(productIds, nextIds)) {
      productIds = nextIds
      notify()
    }

    return { ok: true }
  } catch {
    return {
      ok: false,
      message:
        "No pudimos guardar el historial en este navegador."
    }
  }
}

export function recordProductView(productId) {
  if (
    typeof window === "undefined" ||
    !validId(productId)
  ) {
    return { ok: false }
  }

  initialize()
  refreshFromStorage()

  const nextIds = [
    productId,
    ...productIds.filter(id => id !== productId)
  ].slice(0, MAX_PRODUCTS)

  return saveIds(nextIds)
}

function clearRecentlyViewed() {
  initialize()

  const result = saveIds([])

  if (!result.ok) {
    return {
      ok: false,
      message:
        "No pudimos borrar el historial. Revisá los permisos de almacenamiento del navegador."
    }
  }

  return result
}

export function useRecentlyViewed() {
  const ids = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  return {
    recentlyViewedIds: ids,
    clearRecentlyViewed
  }
}