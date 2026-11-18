import CommerceAdmin from "./CommerceAdmin"
import SalesReports from "./SalesReports"
import ProductExport from "./ProductExport"
import { useState } from "react"

import OrdersAdmin from "./OrdersAdmin"
import ProductsAdmin from "./ProductsAdmin"
import ProductForm from "./ProductForm"
import ContentAdmin from "./ContentAdmin"
import ProductExcelImport from "./ProductExcelImport"

import "./admin.css"

const sections = [
  { id: "delivery", icon: "🚚", title: "Entregas", description: "Configurar retiro y zonas" },
  { id: "coupons", icon: "🏷", title: "Cupones", description: "Administrar descuentos" },
  { id: "reports", icon: "📈", title: "Reportes", description: "Ver y exportar ventas" },
  { id: "export", icon: "📥", title: "Exportar Excel", description: "Descargar catálogo completo" },
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
    id: "import",
    icon: "📊",
    title: "Importar Excel",
    description: "Comparar y actualizar productos"
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

  function backToMenu() {
    setView("menu")
  }

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
            onClick={backToMenu}
          >
            ← Volver al menú
          </button>

          {["delivery", "coupons"].includes(view) && <CommerceAdmin key={view} section={view} />}
          {view === "reports" && <SalesReports />}
          {view === "export" && <ProductExport />}

          {view === "orders" && (
            <OrdersAdmin />
          )}

          {view === "products" && (
            <ProductsAdmin />
          )}

          {view === "create" && (
            <ProductForm onBack={backToMenu} />
          )}

          {view === "import" && (
            <ProductExcelImport />
          )}

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