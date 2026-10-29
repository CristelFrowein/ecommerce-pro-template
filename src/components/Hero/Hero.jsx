import { useEffect, useState } from "react"

import { subscribeContent } from "../../services/contentService"

import "./Hero.css"

function Hero() {
  const [banner, setBanner] = useState(null)

  useEffect(() => {
    return subscribeContent(
      "banners",
      state => {
        const selected = state.items.find(
          item => item.id === state.activeBannerId
        )

        setBanner(selected || null)
      },
      error => {
        console.error(
          "Error al cargar banner:",
          error
        )

        setBanner(null)
      }
    )
  }, [])

  function scrollToProducts() {
    const section = document.getElementById(
      "productos"
    )

    if (!section) return

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    section.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start"
    })
  }

  if (
    !banner ||
    typeof banner.image !== "string" ||
    !banner.image
  ) {
    return null
  }

  return (
    <section
      className="hero"
      style={{
        backgroundImage:
          `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), ` +
          `url(${JSON.stringify(banner.image)})`
      }}
    >
      <div className="hero-content">
        <h1>{banner.title}</h1>

        {banner.subtitle && (
          <p>{banner.subtitle}</p>
        )}

        {banner.buttonText && (
          <button
            type="button"
            className="hero-btn"
            onClick={scrollToProducts}
          >
            {banner.buttonText}
          </button>
        )}
      </div>
    </section>
  )
}

export default Hero