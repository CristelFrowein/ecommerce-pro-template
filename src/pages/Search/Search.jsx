import {
  Link,
  useSearchParams
} from "react-router-dom"

import CatalogResults from "../../components/CatalogResults/CatalogResults"

function Search() {
  const [searchParams] = useSearchParams()

  const term = (
    searchParams.get("q") || ""
  ).trim()

  return (
    <main className="catalog-page container">
      <div className="catalog-page-heading">
        <h1>Resultados de búsqueda</h1>

        {term && (
          <p>
            Buscaste:{" "}
            <span className="catalog-search-term">
              “{term}”
            </span>
          </p>
        )}
      </div>

      {term ? (
        <CatalogResults
          searchTerm={term}
          emptyMessage="No encontramos productos para esa búsqueda."
        />
      ) : (
        <div className="catalog-message">
          <p>
            Escribí el nombre de un producto en el
            buscador para comenzar.
          </p>

          <Link to="/">
            Volver al inicio
          </Link>
        </div>
      )}
    </main>
  )
}

export default Search