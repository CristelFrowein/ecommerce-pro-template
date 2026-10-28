import "./Layout.css"

import Navbar from "../Navbar/Navbar"
import Footer from "../Footer/Footer"
import WhatsAppButton from "../WhatsAppButton/WhatsAppButton"

function Layout({ children }){

  return(

    <div className="layout">

      <Navbar />

      <main className="main-content">

        {children}

      </main>

      <Footer />

      <WhatsAppButton />

    </div>

  )
}

export default Layout