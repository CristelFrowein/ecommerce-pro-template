import "./Hero.css"
import { useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../../services/firebase"

function Hero(){

  const [banner,setBanner] = useState(null)

  useEffect(()=>{

    const getBanner = async () => {

      const snapshot = await getDocs(collection(db,"banners"))

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      if(data.length > 0){
        setBanner(data[0])
      }

    }

    getBanner()

  },[])

  const scrollToProducts = () => {

    const section = document.getElementById("productos")

    if(section){
      section.scrollIntoView({
        behavior:"smooth"
      })
    }

  }

  if(!banner) return null

  return(

    <section
      className="hero"
      style={{
        backgroundImage:
          `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${banner.image})`
      }}
    >

      <div className="hero-content">

        <h1>{banner.title}</h1>

        <p>{banner.subtitle}</p>

        <button
          className="hero-btn"
          onClick={scrollToProducts}
        >
          {banner.buttonText}
        </button>

      </div>

    </section>

  )

}

export default Hero
