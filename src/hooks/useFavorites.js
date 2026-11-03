import { useSyncExternalStore } from "react"

const STORAGE_KEY = "store-favorites"
const MAX_FAVORITES = 100

const EMPTY_FAVORITES = Object.freeze([])

let favoriteIds = EMPTY_FAVORITES
let initialized = false

const listeners = new Set()

function normalizeIds(value) {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(
      value.filter(
        id =>
          typeof id === "string" &&
          id.trim() !== "" &&
          !id.includes("/") &&
          id !== "." &&
          id !== ".."
      )
    )
  ].slice(0, MAX_FAVORITES)
}

function readStorage() {
  const saved = localStorage.getItem(STORAGE_KEY)

  if (!saved) return []

  return normalizeIds(JSON.parse(saved))
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
  if (initialized || typeof window === "undefined") return

  initialized = true

  try {
    favoriteIds = readStorage()
  } catch {
    // La tienda puede seguir funcionando si el almacenamiento falla.
    favoriteIds = EMPTY_FAVORITES
  }
}

function refreshFromStorage() {
  initialize()

  try {
    const saved = readStorage()

    if (!sameIds(favoriteIds, saved)) {
      favoriteIds = saved
      notify()
    }
  } catch {
    // Conservamos los favoritos actuales si no podemos leerlos.
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

    // Recupera cambios hechos mientras no había componentes suscriptos.
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
  return favoriteIds
}

function getServerSnapshot() {
  return EMPTY_FAVORITES
}

function saveFavorites(nextIds) {
  try {
    // Primero guardamos. Si falla, no mostramos un cambio ficticio.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextIds)
    )

    favoriteIds = nextIds
    notify()

    return { ok: true }
  } catch {
    return {
      ok: false,
      message:
        "No pudimos guardar tus favoritos en este navegador. Revisá que el almacenamiento esté permitido."
    }
  }
}

function toggleFavorite(productId) {
  initialize()

  if (
    typeof productId !== "string" ||
    !productId.trim() ||
    productId.includes("/") ||
    productId === "." ||
    productId === ".."
  ) {
    return {
      ok: false,
      message: "No pudimos identificar este producto."
    }
  }

  // Intenta partir de la versión más reciente del navegador.
  refreshFromStorage()

  const alreadySaved = favoriteIds.includes(productId)

  if (!alreadySaved && favoriteIds.length >= MAX_FAVORITES) {
    return {
      ok: false,
      message: `Podés guardar hasta ${MAX_FAVORITES} productos favoritos.`
    }
  }

  const nextIds = alreadySaved
    ? favoriteIds.filter(id => id !== productId)
    : [...favoriteIds, productId]

  const result = saveFavorites(nextIds)

  if (!result.ok) return result

  return {
    ok: true,
    added: !alreadySaved
  }
}

function removeFavorite(productId) {
  initialize()
  refreshFromStorage()

  return saveFavorites(
    favoriteIds.filter(id => id !== productId)
  )
}

export function useFavorites() {
  const ids = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  return {
    favoriteIds: ids,
    favoritesCount: ids.length,
    isFavorite: productId => ids.includes(productId),
    toggleFavorite,
    removeFavorite
  }
}