import { storeConfig } from "../config/storeConfig"

export function getStoreName() {
  return (
    String(storeConfig.storeName || "").trim() ||
    "Mi tienda"
  )
}

export function getWhatsAppUrl(customMessage) {
  const phone = String(
    storeConfig.whatsapp || ""
  ).replace(/\D/g, "")

  if (!phone) return ""

  const template =
    customMessage ??
    storeConfig.whatsappMessage ??
    "Hola! Quería hacer una consulta desde {storeName}."

  const message = String(template).replaceAll(
    "{storeName}",
    getStoreName()
  )

  return (
    `https://wa.me/${phone}` +
    `?text=${encodeURIComponent(message)}`
  )
}

export function getSocialLinks() {
  const links = Array.isArray(storeConfig.socialLinks)
    ? storeConfig.socialLinks
    : []

  return links.flatMap(link => {
    const label = String(
      link?.label || ""
    ).trim()

    const url = String(
      link?.url || ""
    ).trim()

    if (!label || !url) return []

    try {
      const parsed = new URL(url)

      if (
        parsed.protocol !== "https:" &&
        parsed.protocol !== "http:"
      ) {
        return []
      }

      return [{ label, url }]
    } catch {
      return []
    }
  })
}