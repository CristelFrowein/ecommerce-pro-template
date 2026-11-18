import { lazy, Suspense } from "react"

import {
  BrowserRouter,
  Route,
  Routes
} from "react-router-dom"

import Layout from "./components/Layout/Layout"
import Home from "./pages/Home/Home"
import ScrollToTop from "./components/ScrollToTop"

import { ToastContainer } from "react-toastify"

import "react-toastify/dist/ReactToastify.css"

const Cart = lazy(
  () => import("./pages/Cart/Cart")
)

const Favorites = lazy(
  () => import("./pages/Favorites/Favorites")
)

const Category = lazy(
  () => import("./pages/Category/Category")
)

const ProductDetail = lazy(
  () => import("./pages/ProductDetail/ProductDetail")
)

const Search = lazy(
  () => import("./pages/Search/Search")
)

const PaymentResult = lazy(
  () => import("./pages/PaymentResult/PaymentResult")
)

const Tracking = lazy(() => import("./pages/Tracking/Tracking"))

const AdminPage = lazy(
  () => import("./pages/admin/AdminPage")
)

const NotFound = lazy(
  () => import("./pages/NotFound/NotFound")
)

function PageLoader() {
  return (
    <div
      className="container"
      role="status"
      aria-live="polite"
      style={{
        paddingBlock: "40px",
        minHeight: "240px"
      }}
    >
      <p>Cargando página…</p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />

            <Route
              path="/buscar"
              element={<Search />}
            />

            <Route
              path="/categoria/:slug"
              element={<Category />}
            />

            <Route path="/cart" element={<Cart />} />

            <Route
              path="/favoritos"
              element={<Favorites />}
            />

            <Route
              path="/producto/:id"
              element={<ProductDetail />}
            />

            <Route
              path="/pago/resultado"
              element={<PaymentResult />}
            />

            <Route
              path="/admin"
              element={<AdminPage />}
            />

            <Route path="/pedido/:token" element={<Tracking />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>

      <ToastContainer
        className="store-toast-container"
        position="bottom-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="dark"
      />
    </BrowserRouter>
  )
}

export default App