import { useState } from "react"

import OrdersAdmin from "./OrdersAdmin"
import ProductsAdmin from "./ProductsAdmin"
import ProductForm from "./ProductForm"
import ContentAdmin from "./ContentAdmin"

import "./admin.css"

const sections = [
  {
    id: "orders",
    icon: "📦",
    title: "Pedidos",
    description: "Gestionar ventas"
  },
  {
    id: "products",
    icon: "🛍",
    title: "Productos",
    description: "Ver y editar"
  },
  {
    id: "create",
    icon: "➕",
    title: "Crear producto",
    description: "Agregar nuevo"
  },
  {
    id: "categories",
    icon: "🗂",
    title: "Categorías",
    description: "Crear, editar y ordenar"
  },
  {
    id: "banners",
    icon: "🖼",
    title: "Banners",
    description: "Administrar el inicio"
  }
]

function AdminPanel() {
  const [view, setView] = useState("menu")

  return (
    <div className="admin-container container">
      <h1 className="admin-title">
        Panel Admin
      </h1>

      {view === "menu" ? (
        <div className="admin-menu">
          {sections.map(section => (
            <button
              key={section.id}
              type="button"
              className="admin-card-btn"
              onClick={() => setView(section.id)}
            >
              <strong>
                <span aria-hidden="true">
                  {section.icon}
                </span>{" "}
                {section.title}
              </strong>

              <span>
                {section.description}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="admin-back"
            onClick={() => setView("menu")}
          >
            ← Volver al menú
          </button>

          {view === "orders" && <OrdersAdmin />}
          {view === "products" && <ProductsAdmin />}
          {view === "create" && <ProductForm />}

          {view === "categories" && (
            <ContentAdmin
              key="categories"
              type="categories"
            />
          )}

          {view === "banners" && (
            <ContentAdmin
              key="banners"
              type="banners"
            />
          )}
        </>
      )}
    </div>
  )
}

export default AdminPanel