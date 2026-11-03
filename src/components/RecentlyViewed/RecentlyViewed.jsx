import { useEffect, useId, useRef, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "react-toastify"

import { db } from "../../services/firebase"
import { useRecentlyViewed } from "../../hooks/useRecentlyViewed"
import ProductCard from "../ProductCard/ProductCard"

import "./RecentlyViewed.css"

function RecentlyViewed() {
  const {
    recentlyViewedIds,
    clearRecentlyViewed
  } = useRecentlyViewed()

  if (recentlyViewedIds.length === 0) return null

  function handleClear() {
    const result = clearRecentlyViewed()

    if (!result.ok) {
      toast.warning(result.message)
    }
  }

  return (
    <RecentlyViewedContent
      key={JSON.stringify(recentlyViewedIds)}
      ids={recentlyViewedIds}
      onClear={handleClear}
    />
  )
}

function RecentlyViewedContent({ ids, onClear }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      const responses = await Promise.allSettled(
        ids.map(id =>
          getDoc(doc(db, "products", id))
        )
      )

      if (cancelled) return

      const products = []
      let hasErrors = false

      responses.forEach(response => {
        if (response.status === "rejected") {
          hasErrors = true

          console.error(
            "No se pudo cargar un producto visitado:",
            response.reason
          )

          return
        }

        const snapshot = response.value

        if (
          snapshot.exists() &&
          snapshot.data().active !== false
        ) {
          products.push({
            ...snapshot.data(),
            id: snapshot.id
          })
        }
      })

      // Promise.allSettled conserva el orden de los IDs.
      setResult({
        attempt,
        products,
        hasErrors
      })
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [ids, attempt])

  const current =
    result?.attempt === attempt ? result : null

  return (
    <section
      className="recently-viewed"
      aria-label="Vistos recientemente"
    >
      <div className="recently-viewed-header">
        <div>
          <h2>Vistos recientemente</h2>
          <p>Tus últimas visitas, del más reciente al más antiguo.</p>
        </div>

        <button
          type="button"
          className="recently-viewed-clear"
          onClick={onClear}
        >
          Borrar historial
        </button>
      </div>

      {!current ? (
        <p role="status">Cargando productos visitados…</p>
      ) : (
        <>
          {current.hasErrors && (
            <div className="recently-viewed-error" role="alert">
              <p>
                Algunos productos no pudieron cargarse.
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

          {current.products.length > 0 ? (
            <RecentlyViewedTrack
              products={current.products}
            />
          ) : !current.hasErrors ? (
            <p>
              Los productos de tu historial ya no están disponibles.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function RecentlyViewedTrack({ products }) {
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)

  const trackId = useId()

  const [position, setPosition] = useState({
    previous: false,
    next: false
  })

  useEffect(() => {
    const track = trackRef.current

    if (!track) return

    function updatePosition() {
      const maximum = track.scrollWidth - track.clientWidth

      setPosition({
        previous: track.scrollLeft > 2,
        next: track.scrollLeft < maximum - 2
      })
    }

    updatePosition()

    track.addEventListener("scroll", updatePosition, {
      passive: true
    })

    const observer = new ResizeObserver(updatePosition)
    observer.observe(track)

    return () => {
      track.removeEventListener("scroll", updatePosition)
      observer.disconnect()
    }
  }, [products])

  const hasOverflow = position.previous || position.next

  function move(direction) {
    const track = trackRef.current

    if (!track) return

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    track.scrollBy({
      left: direction * track.clientWidth * 0.8,
      behavior: reducedMotion ? "auto" : "smooth"
    })
  }

  function handlePointerDown(event) {
    // El dedo y el lápiz usan el desplazamiento nativo.
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0
    ) {
      return
    }

    suppressClickRef.current = false

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      dragging: false
    }
  }

  function handlePointerMove(event) {
    const drag = dragRef.current

    if (!drag || drag.pointerId !== event.pointerId) return

    const track = event.currentTarget
    const distance = event.clientX - drag.startX

    if (!drag.dragging && Math.abs(distance) > 8) {
      drag.dragging = true
      suppressClickRef.current = true

      track.setPointerCapture(event.pointerId)
      track.classList.add("is-dragging")
    }

    if (!drag.dragging) return

    event.preventDefault()
    track.scrollLeft = drag.scrollLeft - distance
  }

  function endDrag(event) {
    const drag = dragRef.current

    if (!drag || drag.pointerId !== event.pointerId) return

    const track = event.currentTarget

    dragRef.current = null
    track.classList.remove("is-dragging")

    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId)
    }

    if (drag.dragging) {
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
  }

  return (
    <>
      {hasOverflow && (
        <div
          className="recently-viewed-controls"
          role="group"
          aria-label="Mover productos visitados"
        >
          <button
            type="button"
            aria-label="Ver productos anteriores"
            aria-controls={trackId}
            disabled={!position.previous}
            onClick={() => move(-1)}
          >
            <span aria-hidden="true">←</span>
          </button>

          <button
            type="button"
            aria-label="Ver más productos"
            aria-controls={trackId}
            disabled={!position.next}
            onClick={() => move(1)}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      <div
        ref={trackRef}
        id={trackId}
        className="recently-viewed-track"
        role="region"
        aria-label="Listado deslizable de productos visitados"
        tabIndex={hasOverflow ? 0 : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onPointerLeave={event => {
          if (!dragRef.current?.dragging) {
            endDrag(event)
          }
        }}
        onDragStart={event => event.preventDefault()}
        onClickCapture={event => {
          if (!suppressClickRef.current) return

          event.preventDefault()
          event.stopPropagation()
        }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return

          if (event.key === "ArrowRight") {
            event.preventDefault()
            move(1)
          }

          if (event.key === "ArrowLeft") {
            event.preventDefault()
            move(-1)
          }
        }}
      >
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
          />
        ))}
      </div>

      {hasOverflow && (
        <p className="recently-viewed-hint">
          Deslizá hacia los costados o usá las flechas para ver más.
        </p>
      )}
    </>
  )
}

export default RecentlyViewed