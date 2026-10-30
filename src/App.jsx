import { lazy, Suspense } from "react"

import {
  BrowserRouter,
  Route,
  Routes
} from "react-router-dom"

import Layout from "./components/Layout/Layout"

import Home from "./pages/Home/Home"
import Cart from "./pages/Cart/Cart"
import Category from "./pages/Category/Category"
import ProductDetail from "./pages/ProductDetail/ProductDetail"
import Search from "./pages/Search/Search"
import NotFound from "./pages/NotFound/NotFound"
import PaymentResult from "./pages/PaymentResult/PaymentResult"

import { ToastContainer } from "react-toastify"

import "react-toastify/dist/ReactToastify.css"

const AdminPage = lazy(
  () => import("./pages/admin/AdminPage")
)

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={<Home />}
          />

          <Route
            path="/buscar"
            element={<Search />}
          />

          <Route
            path="/categoria/:slug"
            element={<Category />}
          />

          <Route
            path="/cart"
            element={<Cart />}
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
            element={
              <Suspense
                fallback={
                  <div
                    className="container"
                    role="status"
                    aria-live="polite"
                    style={{ padding: "40px 0" }}
                  >
                    <p>Cargando administrador...</p>
                  </div>
                }
              >
                <AdminPage />
              </Suspense>
            }
          />

          <Route
            path="*"
            element={<NotFound />}
          />
        </Routes>
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