const env = import.meta.env

export const storeConfig = {
  // ==============================
  // IDENTIDAD
  // ==============================

  storeName: env.VITE_STORE_NAME || "Demo Store",

  description:
    env.VITE_STORE_DESCRIPTION || "Explorá nuestro catálogo, elegí tus productos y coordiná tu pedido por WhatsApp.",

 
  logo: env.VITE_STORE_LOGO || "/favicon.svg",

  favicon: "/favicon.svg",

  language: "es",
  locale: "es-AR",

  // ==============================
  // TÍTULO DE LA PESTAÑA
  // ==============================

  seo: {
    // Resultado: Demo Store | Tienda online
    titleSuffix: "Tienda online"
  },

  // ==============================
  // WHATSAPP
  // ==============================

  // Número internacional, sin espacios ni símbolos.
  whatsapp: env.VITE_STORE_WHATSAPP || "",

  // {storeName} se reemplaza automáticamente.
  whatsappMessage:
    "Hola! Quería hacer una consulta desde {storeName}.",

  // ==============================
  // PRECIOS
  // ==============================

  // Se conserva por compatibilidad.
  currency: "$",

  // El formato actual de precios utiliza este código.
  currencyCode: "ARS",

  prices: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  },

  // ==============================
  // CONTACTO
  // ==============================

  
  contact: {
    email: env.VITE_STORE_EMAIL || "",
    phone: env.VITE_STORE_WHATSAPP || "",
    address: env.VITE_STORE_ADDRESS || "",
    hours: ""
  },

  // ==============================
  // REDES SOCIALES
  // ==============================

 
  socialLinks: [
    {
      label: "Instagram",
      url: env.VITE_STORE_INSTAGRAM || ""
    },
    {
      label: "Facebook",
      url: env.VITE_STORE_FACEBOOK || ""
    },
    {
      label: "TikTok",
      url: env.VITE_STORE_TIKTOK || ""
    }
  ],

  // ==============================
  // FOOTER
  // ==============================

  footer: {
    text:
      "Explorá nuestros productos y consultanos por tu pedido.",

    // Ambas variables se reemplazan automáticamente.
    copyrightText: "© {year} {storeName}"
  }
}

export const paymentMode = ["test", "live"].includes(env.VITE_PAYMENT_MODE) ? env.VITE_PAYMENT_MODE : "off"
