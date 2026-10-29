import { Link } from "react-router-dom"
import "./NotFound.css"

function NotFound() {
  return (
    <main className="not-found container">
      <section className="not-found-card">
        <span
          className="not-found-number"
          aria-hidden="true"
        >
          404
        </span>

        <h1>No encontramos esta página</h1>

        <p>
          La dirección puede estar mal escrita
          o la página ya no estar disponible.
        </p>

        <div className="not-found-actions">
          <Link
            to="/"
            className="not-found-primary"
          >
            Volver al inicio
          </Link>

          <Link
            to="/buscar"
            className="not-found-secondary"
          >
            Buscar productos
          </Link>
        </div>
      </section>
    </main>
  )
}

export default NotFound