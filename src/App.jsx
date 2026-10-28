import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar/Navbar"

import Home from "./pages/Home/Home"
import Cart from "./pages/Cart/Cart"
import Category from "./pages/Category/Category"
import ProductDetail from "./pages/ProductDetail/ProductDetail"
import AdminPage from "./pages/admin/AdminPage"

import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

function App() {
  return (

    <BrowserRouter>

      <Navbar />

      <Routes>

        <Route path="/" element={<Home />} />
        <Route path="/categoria/:slug" element={<Category />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/producto/:id" element={<ProductDetail />} />
        <Route path="/admin" element={<AdminPage />} />

      </Routes>

      <ToastContainer
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