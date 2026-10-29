import { FaWhatsapp } from "react-icons/fa"

import { getWhatsAppUrl } from "../../utils/storeUtils"

import "./WhatsAppButton.css"

function WhatsAppButton() {
  const url = getWhatsAppUrl()

  if (!url) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-button"
      aria-label="Consultar por WhatsApp, se abre en otra pestaña"
      title="Consultanos por WhatsApp"
    >
      <FaWhatsapp
        size={28}
        aria-hidden="true"
      />
    </a>
  )
}

export default WhatsAppButton