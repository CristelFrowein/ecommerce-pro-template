import { useLayoutEffect } from "react"

import {
  useLocation,
  useNavigationType
} from "react-router-dom"

import Navbar from "../Navbar/Navbar"
import Footer from "../Footer/Footer"
import WhatsAppButton from "../WhatsAppButton/WhatsAppButton"

import "./Layout.css"

function Layout({ children }) {
  const { pathname, search, hash } = useLocation()
  const navigationType = useNavigationType()

  const isAdmin =
    pathname === "/admin" ||
    pathname.startsWith("/admin/")

  useLayoutEffect(() => {
    // Dejamos que el navegador gestione
    // atrás/adelante y los enlaces con anclas.
    if (
      navigationType === "POP" ||
      hash
    ) {
      return
    }

    window.scrollTo(0, 0)
  }, [
    pathname,
    search,
    hash,
    navigationType
  ])

  return (
    <div className="layout">
      <Navbar />

      <div className="main-content">
        {children}
      </div>

      <Footer />

      {!isAdmin && <WhatsAppButton />}
    </div>
  )
}

export default Layout