import { Link } from "react-router-dom"

import { storeConfig } from "../../config/storeConfig"

import {
  getSocialLinks,
  getStoreName,
  getWhatsAppUrl
} from "../../utils/storeUtils"

import "./Footer.css"

function Footer() {
  const storeName = getStoreName()
  const whatsappUrl = getWhatsAppUrl()
  const socialLinks = getSocialLinks()

  const email = String(
    storeConfig.contact?.email || ""
  ).trim()

  const phone = String(
    storeConfig.contact?.phone || ""
  ).trim()

  const address = String(
    storeConfig.contact?.address || ""
  ).trim()

  const hours = String(
    storeConfig.contact?.hours || ""
  ).trim()

  const hasContact =
    email || phone || address || hours

  const footerText = String(
    storeConfig.footer?.text || ""
  ).trim()

  const copyright = String(
    storeConfig.footer?.copyrightText ||
    "© {year} {storeName}"
  )
    .replaceAll(
      "{year}",
      String(new Date().getFullYear())
    )
    .replaceAll(
      "{storeName}",
      storeName
    )

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-content">
          <div className="footer-brand">
            <Link
              to="/"
              className="footer-store-name"
            >
              {storeConfig.logo && (
                <img
                  key={storeConfig.logo}
                  src={storeConfig.logo}
                  alt=""
                  className="footer-logo"
                  width={38}
                  height={38}
                  onError={event => {
                    event.currentTarget.style.display = "none"
                  }}
                />
              )}

              <span>{storeName}</span>
            </Link>

            {footerText && (
              <p>{footerText}</p>
            )}
          </div>

          {hasContact && (
            <div className="footer-contact">
              <h2>Contacto</h2>

              {email && (
                <a href={`mailto:${email}`}>
                  {email}
                </a>
              )}

              {phone && (
                <a
                  href={`tel:${phone.replace(
                    /[^\d+]/g,
                    ""
                  )}`}
                >
                  {phone}
                </a>
              )}

              {address && <p>{address}</p>}

              {hours && <p>{hours}</p>}
            </div>
          )}

          <div className="footer-navigation">
            <nav
              className="footer-links"
              aria-label="Enlaces del pie de página"
            >
              <Link to="/">Inicio</Link>

              <Link to="/buscar">
                Buscar productos
              </Link>

              <Link to="/cart">
                Carrito
              </Link>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Consultar por WhatsApp, se abre en otra pestaña"
                >
                  WhatsApp
                </a>
              )}
            </nav>

            {socialLinks.length > 0 && (
              <div className="footer-social-section">
                <h2>Seguinos</h2>

                <nav
                  className="footer-social-links"
                  aria-label="Redes sociales"
                >
                  {socialLinks.map(link => (
                    <a
                      key={`${link.label}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${link.label}, se abre en otra pestaña`}
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </div>

        <div className="footer-bottom">
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer