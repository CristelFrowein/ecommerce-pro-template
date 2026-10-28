import "./WhatsAppButton.css"
import { FaWhatsapp } from "react-icons/fa"
import { storeConfig } from "../../config/storeConfig"

function WhatsAppButton(){

  const url = `https://wa.me/${storeConfig.whatsapp}`

  return(

    <a
      href={url}
      target="_blank"
      className="whatsapp-button"
    >

      <FaWhatsapp size={28} />

    </a>

  )

}

export default WhatsAppButton