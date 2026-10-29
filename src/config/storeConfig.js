export const storeConfig = {
  // ==============================
  // IDENTIDAD
  // ==============================

  storeName: "Demo Store",

  description:
    "Explorá nuestro catálogo, elegí tus productos y coordiná tu pedido por WhatsApp.",

 
  logo: "/logo.png",

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
  whatsapp: "5492230000000",

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
    email: "demo@gmail.com",
    phone: "5492230000000",
    address: "Av. demo 123",
    hours: ""
  },

  // ==============================
  // REDES SOCIALES
  // ==============================

 
  socialLinks: [
    {
      label: "Instagram",
      url: "instagram.com/demostore"
    },
    {
      label: "Facebook",
      url: "facebook.com/demostore"
    },
    {
      label: "TikTok",
      url: ""
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