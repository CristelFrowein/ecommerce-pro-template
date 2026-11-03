import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { FiHeart } from "react-icons/fi"
import { toast } from "react-toastify"

import { db } from "../../services/firebase"
import { useFavorites } from "../../hooks/useFavorites"
import ProductCard from "../../components/ProductCard/ProductCard"

import "./Favorites.css"

function Favorites() {
  const { favoriteIds, removeFavorite } = useFavorites()

  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)

  const requestKey = JSON.stringify(favoriteIds)

  useEffect(() => {
    let cancelled = false
    const ids = JSON.parse(requestKey)

    if (ids.length === 0) return

    async function loadFavorites() {
      const entries = []

      // Consultamos en grupos para limitar las solicitudes simultáneas.
      for (let index = 0; index < ids.length; index += 8) {
        if (cancelled) return

        const batch = ids.slice(index, index + 8)

        const responses = await Promise.allSettled(
          batch.map(id =>
            getDoc(doc(db, "products", id))
          )
        )

        if (cancelled) return

        responses.forEach((response, position) => {
          const id = batch[position]

          if (response.status === "rejected") {
            console.error(
              "No se pudo consultar un favorito:",
              response.reason
            )

            entries.push({
              id,
              state: "error"
            })

            return
          }

          const snapshot = response.value

          if (
            !snapshot.exists() ||
            snapshot.data().active === false
          ) {
            entries.push({
              id,
              state: "unavailable"
            })

            return
          }

          entries.push({
            id,
            state: "available",
            product: {
              ...snapshot.data(),
              id: snapshot.id
            }
          })
        })
      }

      if (!cancelled) {
        setResult({
          requestKey,
          attempt,
          entries
        })
      }
    }

    loadFavorites()

    return () => {
      cancelled = true
    }
  }, [requestKey, attempt])

  const current =
    result?.requestKey === requestKey &&
    result?.attempt === attempt
      ? result
      : null

  const loading =
    favoriteIds.length > 0 && !current

  const hasErrors = current?.entries.some(
    entry => entry.state === "error"
  )

  function handleRemove(id) {
    const response = removeFavorite(id)

    if (!response.ok) {
      toast.warning(response.message)
    }
  }

  return (
    <div className="favorites-page container">
      <header className="favorites-header">
        <div>
          <h1>Mis favoritos</h1>

          <p>
            {favoriteIds.length === 0
              ? "Guardá los productos que te gustan para encontrarlos fácilmente."
              : `${favoriteIds.length} ${
                  favoriteIds.length === 1
                    ? "producto guardado"
                    : "productos guardados"
                }`}
          </p>
        </div>

        <Link to="/" className="favorites-link">
          Seguir explorando
        </Link>
      </header>

      {favoriteIds.length === 0 ? (
        <section className="favorites-empty">
          <FiHeart aria-hidden="true" />

          <h2>Todavía no tenés favoritos</h2>

          <p>
            Tocá el corazón de un producto para guardarlo acá.
          </p>

          <Link to="/" className="favorites-primary">
            Explorar productos
          </Link>
        </section>
      ) : loading ? (
        <p className="favorites-loading" role="status">
          Cargando tus favoritos…
        </p>
      ) : (
        <>
          {hasErrors && (
            <div className="favorites-error" role="alert">
              <p>
                Algunos productos no pudieron cargarse.
                Podés volver a intentarlo.
              </p>

              <button
                type="button"
                onClick={() =>
                  setAttempt(previous => previous + 1)
                }
              >
                Reintentar
              </button>
            </div>
          )}

          <div className="products-grid favorites-grid">
            {current.entries.map(entry =>
              entry.state === "available" ? (
                <ProductCard
                  key={entry.id}
                  product={entry.product}
                />
              ) : (
                <article
                  key={entry.id}
                  className="favorite-unavailable"
                >
                  <FiHeart aria-hidden="true" />

                  <h2>
                    {entry.state === "error"
                      ? "No pudimos cargar este producto"
                      : "Producto no disponible"}
                  </h2>

                  <p>
                    {entry.state === "error"
                      ? "Lo conservamos en tus favoritos para que puedas consultar más tarde."
                      : "Este producto ya no está disponible en la tienda."}
                  </p>

                  <button
                    type="button"
                    onClick={() => handleRemove(entry.id)}
                  >
                    Quitar de favoritos
                  </button>
                </article>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Favorites