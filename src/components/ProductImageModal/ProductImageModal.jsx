import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import "./ProductImageModal.css"

function ModalImage({ src, name }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className="gallery-dialog-placeholder"
        role="img"
        aria-label={`Imagen no disponible de ${name}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="3"
          />
          <circle cx="8" cy="8" r="1.5" />
          <path d="m3 16 5-5 5 5 3-3 5 5" />
        </svg>

        <p>Imagen no disponible</p>
      </div>
    )
  }

  return (
    <img
      className="gallery-dialog-image"
      src={src}
      alt={name}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

function ProductImageModal({
  images,
  selectedImage,
  productName,
  onSelect,
  onClose
}) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const gestureRef = useRef(null)

  const count = images.length

  const index =
    selectedImage >= 0 && selectedImage < count
      ? selectedImage
      : 0

  function move(direction) {
    if (count < 2) return

    onSelect(previous =>
      (previous + direction + count) % count
    )
  }

  useEffect(() => {
    const previousFocus = document.activeElement
    const body = document.body
    const root = document.documentElement

    const scrollX = window.scrollX
    const scrollY = window.scrollY

    const previousStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      scrollBehavior: root.style.scrollBehavior
    }

    const scrollbarWidth =
      window.innerWidth - root.clientWidth

    if (scrollbarWidth > 0) {
      const padding =
        Number.parseFloat(
          window.getComputedStyle(body).paddingRight
        ) || 0

      body.style.paddingRight =
        `${padding + scrollbarWidth}px`
    }

    body.style.position = "fixed"
    body.style.top = `-${scrollY}px`
    body.style.left = `-${scrollX}px`
    body.style.width = "100%"
    body.style.overflow = "hidden"

    closeRef.current?.focus({ preventScroll: true })

    function keepFocusInside(event) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target)
      ) {
        closeRef.current?.focus({ preventScroll: true })
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        onClose(false)
        return
      }

      if (
        count > 1 &&
        (
          event.key === "ArrowRight" ||
          event.key === "ArrowLeft"
        )
      ) {
        event.preventDefault()

        const direction =
          event.key === "ArrowRight" ? 1 : -1

        onSelect(previous =>
          (previous + direction + count) % count
        )

        return
      }

      if (event.key !== "Tab") return

      const buttons = [
        ...dialogRef.current.querySelectorAll(
          "button:not(:disabled)"
        )
      ]

      const first = buttons[0]
      const last = buttons[buttons.length - 1]

      if (!first) {
        event.preventDefault()
        return
      }

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
      true
    )

    document.addEventListener(
      "focusin",
      keepFocusInside
    )

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
        true
      )

      document.removeEventListener(
        "focusin",
        keepFocusInside
      )

      Object.assign(body.style, {
        position: previousStyles.position,
        top: previousStyles.top,
        left: previousStyles.left,
        width: previousStyles.width,
        overflow: previousStyles.overflow,
        paddingRight: previousStyles.paddingRight
      })

      root.style.scrollBehavior = "auto"
      window.scrollTo(scrollX, scrollY)
      root.style.scrollBehavior =
        previousStyles.scrollBehavior

      if (previousFocus?.isConnected) {
        previousFocus.focus?.({ preventScroll: true })
      }
    }
  }, [count, onClose, onSelect])

  function handleTouchStart(event) {
    if (
      count < 2 ||
      event.touches.length !== 1 ||
      (window.visualViewport?.scale || 1) > 1.05
    ) {
      gestureRef.current = null
      return
    }

    const touch = event.touches[0]

    gestureRef.current = {
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY
    }
  }

  function handleTouchEnd(event) {
    const start = gestureRef.current
    gestureRef.current = null

    if (
      !start ||
      event.touches.length > 0 ||
      (window.visualViewport?.scale || 1) > 1.05
    ) {
      return
    }

    const touch = Array.from(
      event.changedTouches
    ).find(
      item => item.identifier === start.identifier
    )

    if (!touch) return

    const distanceX = touch.clientX - start.x
    const distanceY = touch.clientY - start.y

    if (
      Math.abs(distanceX) >= 50 &&
      Math.abs(distanceX) > Math.abs(distanceY) * 1.3
    ) {
      move(distanceX < 0 ? 1 : -1)
    }
  }

  return createPortal(
    <div
      className="gallery-dialog-overlay"
      onClick={event => {
        if (event.target === event.currentTarget) {
          onClose(false)
        }
      }}
    >
      <div
        ref={dialogRef}
        className="gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Imágenes de ${productName}`}
      >
        <button
          ref={closeRef}
          type="button"
          className="gallery-dialog-close"
          aria-label="Cerrar galería"
          onClick={() => onClose(false)}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div
          className="gallery-dialog-stage"
          onTouchStart={handleTouchStart}
          onTouchMove={event => {
            if (event.touches.length !== 1) {
              gestureRef.current = null
            }
          }}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            gestureRef.current = null
          }}
        >
          <ModalImage
            key={images[index] || ""}
            src={images[index] || ""}
            name={productName}
          />
        </div>

        {count > 1 && (
          <div className="gallery-dialog-navigation">
            <button
              type="button"
              aria-label="Imagen anterior"
              onClick={() => move(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>

            <p
              className="gallery-dialog-counter"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              Imagen {index + 1} de {count}
            </p>

            <button
              type="button"
              aria-label="Imagen siguiente"
              onClick={() => move(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {count > 1 && (
          <p className="gallery-dialog-hint">
            Deslizá la imagen o usá las flechas.
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}

export default ProductImageModal