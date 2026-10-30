import { useEffect, useRef, useState } from "react"

import ProductCard from "../../components/ProductCard/ProductCard"

import "./ProductRelated.css"

function RelatedProducts({ products }) {
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)

  const [position, setPosition] = useState({
    previous: false,
    next: false
  })

  const count = products.length

  useEffect(() => {
    const track = trackRef.current

    if (!track || count === 0) return

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
  }, [count])

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
      // Bloquea el clic que puede producirse al soltar el arrastre.
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
  }

  function handleClickCapture(event) {
    if (!suppressClickRef.current) return

    event.preventDefault()
    event.stopPropagation()
  }

  function handleKeyDown(event) {
    if (event.target !== event.currentTarget) return

    if (event.key === "ArrowRight") {
      event.preventDefault()
      move(1)
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault()
      move(-1)
    }
  }

  if (count === 0) return null

  const hasOverflow = position.previous || position.next

  return (
    <section
      className="related-section"
      aria-label="Productos relacionados"
    >
      <div className="related-header">
        <div>
          <span>TAMBIÉN TE PUEDE INTERESAR</span>
          <h2>Productos relacionados</h2>
        </div>

        {hasOverflow && (
          <div
            className="related-controls"
            role="group"
            aria-label="Mover productos relacionados"
          >
            <button
              type="button"
              aria-label="Ver productos anteriores"
              disabled={!position.previous}
              onClick={() => move(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>

            <button
              type="button"
              aria-label="Ver más productos"
              disabled={!position.next}
              onClick={() => move(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>

      <div
        ref={trackRef}
        className="related-track"
        tabIndex={hasOverflow ? 0 : undefined}
        role="region"
        aria-label="Listado deslizable de productos relacionados"
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
        onClickCapture={handleClickCapture}
        onDragStart={event => event.preventDefault()}
        onKeyDown={handleKeyDown}
      >
        {products.map(product => (
          <ProductCard
            key={product.id}
            product={product}
          />
        ))}
      </div>

    </section>
  )
}

export default RelatedProducts