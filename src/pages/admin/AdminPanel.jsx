import { useState } from "react"
import "./admin.css"

import OrdersAdmin from "./OrdersAdmin"
import ProductsAdmin from "./ProductsAdmin"
import ProductForm from "./ProductForm"

function AdminPanel() {

  const [view, setView] = useState("menu")

  return (

    <div className="admin-container container">

      <h1 className="admin-title">Panel Admin</h1>

      {view === "menu" && (
        <div className="admin-menu">

          <button
            className="admin-card-btn"
            onClick={() => setView("orders")}
          >
            📦 Pedidos
            <span>Gestionar ventas</span>
          </button>

          <button
            className="admin-card-btn"
            onClick={() => setView("products")}
          >
            🛍 Productos
            <span>Ver y editar</span>
          </button>

          <button
            className="admin-card-btn"
            onClick={() => setView("create")}
          >
            ➕ Crear producto
            <span>Agregar nuevo</span>
          </button>

        </div>
      )}

      {view === "orders" && (
        <>
          <button className="admin-back" onClick={() => setView("menu")}>
            ← Volver
          </button>
          <OrdersAdmin />
        </>
      )}

      {view === "products" && (
        <>
          <button className="admin-back" onClick={() => setView("menu")}>
            ← Volver
          </button>
          <ProductsAdmin />
        </>
      )}

      {view === "create" && (
        <>
          <button className="admin-back" onClick={() => setView("menu")}>
            ← Volver
          </button>
          <ProductForm />
        </>
      )}

    </div>

  )
}

export default AdminPanel