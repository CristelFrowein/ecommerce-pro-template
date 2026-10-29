import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore"

import { db } from "./firebase"

const BANNER_SETTINGS_ID = "__settings__"

export function createSlug(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function validateImageUrl(value) {
  const text = String(value ?? "").trim()

  let parsed

  try {
    parsed = new URL(text)
  } catch {
    throw new Error(
      "Ingresá una URL completa para la imagen."
    )
  }

  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:"
  ) {
    throw new Error(
      "La imagen debe tener una URL http o https."
    )
  }

  return text
}

function getCollection(type) {
  if (
    type !== "categories" &&
    type !== "banners"
  ) {
    throw new Error("Tipo de contenido inválido.")
  }

  return collection(db, type)
}

function decodeContent(type, snapshot) {
  const documents = snapshot.docs.map(document => ({
    ...document.data(),
    id: document.id
  }))

  if (type === "categories") {
    const items = documents.sort((a, b) => {
      const orderA = Number.isFinite(Number(a.order))
        ? Number(a.order)
        : 0

      const orderB = Number.isFinite(Number(b.order))
        ? Number(b.order)
        : 0

      return (
        orderA - orderB ||
        String(a.name || "").localeCompare(
          String(b.name || ""),
          "es",
          { sensitivity: "base" }
        )
      )
    })

    return {
      items,
      activeBannerId: null
    }
  }

  const settings = documents.find(
    item => item.id === BANNER_SETTINGS_ID
  )

  const banners = documents.filter(
    item => item.id !== BANNER_SETTINGS_ID
  )

  // Compatibilidad con los banners que ya existían.
  const activeBannerId = settings
    ? settings.activeBannerId || null
    : banners[0]?.id || null

  return {
    items: banners.sort((a, b) =>
      String(a.title || "").localeCompare(
        String(b.title || ""),
        "es",
        { sensitivity: "base" }
      )
    ),
    activeBannerId
  }
}

export function subscribeContent(
  type,
  onData,
  onError
) {
  return onSnapshot(
    getCollection(type),
    snapshot => {
      onData(decodeContent(type, snapshot))
    },
    onError
  )
}

export async function saveContent(
  type,
  form,
  editingId = null
) {
  const image = validateImageUrl(form.image)

  if (type === "categories") {
    const name = String(form.name || "").trim()

    const slug = editingId
      ? String(form.slug || "").trim()
      : createSlug(name)

    const order = Number(form.order)

    if (!name || !slug) {
      throw new Error(
        "Completá el nombre de la categoría."
      )
    }

    if (
      !Number.isSafeInteger(order) ||
      order < 0
    ) {
      throw new Error(
        "El orden debe ser un número entero igual o mayor a cero."
      )
    }

    const duplicates = await getDocs(
      query(
        collection(db, "categories"),
        where("slug", "==", slug)
      )
    )

    if (
      duplicates.docs.some(
        document => document.id !== editingId
      )
    ) {
      throw new Error(
        "Ya existe una categoría con ese identificador."
      )
    }

    const reference = doc(
      db,
      "categories",
      editingId || slug
    )

    await runTransaction(db, async transaction => {
      const current = await transaction.get(reference)

      if (editingId) {
        if (!current.exists()) {
          throw new Error(
            "La categoría ya no existe."
          )
        }

        if (current.data().slug !== slug) {
          throw new Error(
            "El identificador de la categoría cambió. Volvé a seleccionarla."
          )
        }
      } else if (current.exists()) {
        throw new Error(
          "Ya existe una categoría con ese identificador."
        )
      }

      transaction.set(
        reference,
        {
          name,
          slug,
          image,
          order,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      )
    })

    return
  }

  if (type !== "banners") {
    throw new Error("Tipo de contenido inválido.")
  }

  const title = String(form.title || "").trim()

  if (!title) {
    throw new Error(
      "Completá el título del banner."
    )
  }

  const snapshot = await getDocs(
    collection(db, "banners")
  )

  const previousState = decodeContent(
    "banners",
    snapshot
  )

  const reference = editingId
    ? doc(db, "banners", editingId)
    : doc(collection(db, "banners"))

  const settingsRef = doc(
    db,
    "banners",
    BANNER_SETTINGS_ID
  )

  await runTransaction(db, async transaction => {
    const settings = await transaction.get(
      settingsRef
    )

    if (editingId) {
      const current = await transaction.get(
        reference
      )

      if (!current.exists()) {
        throw new Error(
          "El banner ya no existe."
        )
      }
    }

    transaction.set(
      reference,
      {
        title,
        subtitle: String(form.subtitle || "").trim(),
        buttonText: String(form.buttonText || "").trim(),
        image,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )

    // Conserva el banner anterior al inicializar
    // la selección, o muestra el primero creado.
    if (!settings.exists()) {
      transaction.set(settingsRef, {
        activeBannerId:
          previousState.activeBannerId ||
          reference.id
      })
    }
  })
}

export async function setActiveBanner(id) {
  if (id !== null) {
    if (id === BANNER_SETTINGS_ID) {
      throw new Error("Banner inválido.")
    }

    const snapshot = await getDoc(
      doc(db, "banners", id)
    )

    if (!snapshot.exists()) {
      throw new Error(
        "El banner ya no existe."
      )
    }
  }

  await setDoc(
    doc(db, "banners", BANNER_SETTINGS_ID),
    { activeBannerId: id },
    { merge: true }
  )
}

export async function deleteContent(type, id) {
  if (type === "categories") {
    const reference = doc(db, "categories", id)
    const snapshot = await getDoc(reference)

    if (!snapshot.exists()) {
      throw new Error(
        "La categoría ya no existe."
      )
    }

    const slug = snapshot.data().slug

    if (!slug) {
      throw new Error(
        "La categoría no tiene un identificador válido."
      )
    }

    const products = await getDocs(
      query(
        collection(db, "products"),
        where("category", "==", slug),
        limit(1)
      )
    )

    if (!products.empty) {
      throw new Error(
        "No podés eliminar esta categoría porque tiene productos asociados, incluso si están inactivos. Primero reasignalos a otra categoría."
      )
    }

    await runTransaction(db, async transaction => {
      const current = await transaction.get(reference)

      if (!current.exists()) return

      if (current.data().slug !== slug) {
        throw new Error(
          "La categoría cambió. Intentá nuevamente."
        )
      }

      transaction.delete(reference)
    })

    return
  }

  if (
    type !== "banners" ||
    id === BANNER_SETTINGS_ID
  ) {
    throw new Error("Contenido inválido.")
  }

  const snapshot = await getDocs(
    collection(db, "banners")
  )

  const previousState = decodeContent(
    "banners",
    snapshot
  )

  const reference = doc(db, "banners", id)

  const settingsRef = doc(
    db,
    "banners",
    BANNER_SETTINGS_ID
  )

  await runTransaction(db, async transaction => {
    const settings = await transaction.get(
      settingsRef
    )

    const current = await transaction.get(
      reference
    )

    if (!current.exists()) return

    const activeBannerId = settings.exists()
      ? settings.data().activeBannerId || null
      : previousState.activeBannerId

    transaction.delete(reference)

    transaction.set(
      settingsRef,
      {
        activeBannerId:
          activeBannerId === id
            ? null
            : activeBannerId
      },
      { merge: true }
    )
  })
}