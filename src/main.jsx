import React from "react"
import ReactDOM from "react-dom/client"

import App from "./App.jsx"
import { CartProvider } from "./context/CartProvider.jsx"

import { storeConfig } from "./config/storeConfig"
import { getStoreName } from "./utils/storeUtils"

import "./index.css"

// ==============================
// IDENTIDAD DEL DOCUMENTO
// ==============================

const storeName = getStoreName()

const titleSuffix = String(
  storeConfig.seo?.titleSuffix || ""
).trim()

document.title = titleSuffix
  ? `${storeName} | ${titleSuffix}`
  : storeName

document.documentElement.lang =
  storeConfig.language || "es"

const descriptionMeta = document.querySelector(
  'meta[name="description"]'
)

if (descriptionMeta) {
  descriptionMeta.setAttribute(
    "content",
    String(storeConfig.description || "")
  )
}

const faviconLink = document.querySelector(
  'link[rel="icon"]'
)

if (faviconLink) {
  faviconLink.setAttribute(
    "href",
    storeConfig.favicon || "/favicon.svg"
  )

  // Permite utilizar SVG, PNG u otro formato
  // sin conservar un tipo anterior.
  faviconLink.removeAttribute("type")
}

// ==============================
// APLICACIÓN
// ==============================

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </React.StrictMode>
)