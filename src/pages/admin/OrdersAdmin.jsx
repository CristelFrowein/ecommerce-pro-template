import { useEffect, useState } from "react"
import {
  collection,
  getDocs,
  doc,
  runTransaction
} from "firebase/firestore"

import { db } from "../../services/firebase"

import "./OrdersAdmin.css"


function OrdersAdmin({ onBack }) {

  const [orders, setOrders] = useState([])

  const [processing, setProcessing] = useState({})


  /* ========================================
     CARGAR PEDIDOS
  ======================================== */

  useEffect(() => {
    loadOrders()
  }, [])


  async function loadOrders() {

    try {

      const snap = await getDocs(
        collection(db, "orders")
      )

      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setOrders(data)

    } catch (error) {

      console.error(
        "Error al cargar pedidos:",
        error
      )

    }
  }


  /* ========================================
     COMPLETAR PEDIDO
     Y DESCONTAR STOCK
  ======================================== */

  async function completeOrder(order) {

    if (processing[order.id]) {
      return
    }


    /*
     * Si ya está completado,
     * no hacemos absolutamente nada.
     */

    if (order.status === "completed") {
      return
    }


    setProcessing(prev => ({
      ...prev,
      [order.id]: true
    }))


    try {

      await runTransaction(
        db,
        async transaction => {


          /* ========================================
             1. LEER EL PEDIDO
          ======================================== */

          const orderRef = doc(
            db,
            "orders",
            order.id
          )

          const orderSnap =
            await transaction.get(orderRef)


          if (!orderSnap.exists()) {

            throw new Error(
              "El pedido ya no existe."
            )

          }


          const currentOrder =
            orderSnap.data()


          /*
           * Si otro proceso ya lo completó,
           * no descontamos nuevamente.
           */

          if (
            currentOrder.status ===
            "completed"
          ) {

            return
          }


          /* ========================================
             2. PREPARAR PRODUCTOS
          ======================================== */

          const items =
            currentOrder.items || []


          const productsToUpdate =
            []


          for (const item of items) {

            const productId =
              item.productId || item.id


            if (!productId) {

              throw new Error(
                `El producto "${item.name}" no tiene ID de Firebase.`
              )

            }


            const productRef = doc(
              db,
              "products",
              productId
            )


            productsToUpdate.push({
              item,
              productRef
            })

          }


          /* ========================================
             3. LEER TODOS LOS PRODUCTOS
             
             IMPORTANTE:
             TODAS las lecturas ocurren acá,
             antes de cualquier escritura.
          ======================================== */

          const productSnapshots = []


          for (
            const productData
            of productsToUpdate
          ) {

            const productSnap =
              await transaction.get(
                productData.productRef
              )


            productSnapshots.push({
              ...productData,
              productSnap
            })

          }


          /* ========================================
             4. VERIFICAR TODO ANTES DE ESCRIBIR
          ======================================== */

          for (
            const productData
            of productSnapshots
          ) {

            const {
              item,
              productSnap
            } = productData


            if (!productSnap.exists()) {

              throw new Error(
                `El producto "${item.name}" ya no existe.`
              )

            }


            const product =
              productSnap.data()


            const currentStock =
              Number(product.stock) || 0


            const quantity =
              Number(item.quantity) || 0


            if (quantity <= 0) {
              continue
            }


            if (
              currentStock <
              quantity
            ) {

              throw new Error(
                `No hay suficiente stock de "${item.name}". Stock actual: ${currentStock}. Pedido: ${quantity}.`
              )

            }

          }


          /* ========================================
             5. AHORA SÍ: ACTUALIZAR STOCK
          ======================================== */

          for (
            const productData
            of productSnapshots
          ) {

            const {
              item,
              productSnap,
              productRef
            } = productData


            const product =
              productSnap.data()


            const currentStock =
              Number(product.stock) || 0


            const quantity =
              Number(item.quantity) || 0


            if (quantity <= 0) {
              continue
            }


            const newStock =
              currentStock - quantity


            transaction.update(
              productRef,
              {
                stock: newStock
              }
            )

          }


          /* ========================================
             6. MARCAR PEDIDO COMO COMPLETADO
          ======================================== */

          transaction.update(
            orderRef,
            {
              status: "completed"
            }
          )

        }
      )


      /* ========================================
         RECARGAR PEDIDOS
      ======================================== */

      await loadOrders()


    } catch (error) {

      console.error(
        "Error al completar pedido:",
        error
      )


      alert(
        error.message ||
        "No se pudo completar el pedido."
      )


    } finally {

      setProcessing(prev => ({
        ...prev,
        [order.id]: false
      }))

    }
  }


  /* ========================================
     RENDER
  ======================================== */

  return (

    <div className="orders-admin">


      {/* ========================================
          HEADER
      ======================================== */}

      <div className="orders-title">

        <div>

          <h2>
            Pedidos
          </h2>

          <p>
            Gestioná los pedidos recibidos
          </p>

        </div>


        {onBack && (

          <button
            className="orders-back"
            onClick={onBack}
          >
            ← Volver
          </button>

        )}

      </div>


      {/* ========================================
          LISTA
      ======================================== */}

      <div className="orders-list">

        {orders.length === 0 ? (

          <div className="orders-empty">

            <span>
              📦
            </span>

            <h3>
              No hay pedidos todavía
            </h3>

            <p>
              Los nuevos pedidos aparecerán aquí.
            </p>

          </div>

        ) : (

          orders.map(order => (

            <article
              key={order.id}
              className="order-card"
            >


              {/* ========================================
                  HEADER
              ======================================== */}

              <div className="order-header">

                <div className="order-customer">

                  <div className="customer-avatar">

                    {order.customer?.name
                      ?.charAt(0)
                      ?.toUpperCase() || "?"}

                  </div>


                  <div>

                    <strong>
                      {order.customer?.name ||
                        "Cliente"}
                    </strong>

                    <span>
                      {order.customer?.phone ||
                        "Sin teléfono"}
                    </span>

                  </div>

                </div>


                <span
                  className={`order-status status-${
                    order.status ||
                    "pending"
                  }`}
                >

                  {order.status ===
                  "completed"

                    ? "Completado"

                    : order.status ===
                      "cancelled"

                    ? "Cancelado"

                    : "Pendiente"}

                </span>

              </div>


              {/* ========================================
                  PRODUCTOS
              ======================================== */}

              <div className="order-content">

                <div className="order-section-title">
                  Productos
                </div>


                <ul className="order-items">

                  {order.items?.map(
                    (item, i) => (

                      <li key={i}>

                        <span className="item-name">
                          {item.name}
                        </span>

                        <span className="item-quantity">
                          × {item.quantity}
                        </span>

                      </li>

                    )
                  )}

                </ul>

              </div>


              {/* ========================================
                  FOOTER
              ======================================== */}

              <div className="order-footer">

                <div className="order-total">

                  <span>
                    Total
                  </span>

                  <strong>
                    $
                    {Number(
                      order.total || 0
                    ).toLocaleString(
                      "es-AR"
                    )}
                  </strong>

                </div>


                <div className="order-actions">

                  {order.status !==
                    "completed" && (

                    <button
                      className="complete-button"
                      disabled={
                        processing[
                          order.id
                        ]
                      }
                      onClick={() =>
                        completeOrder(
                          order
                        )
                      }
                    >

                      {processing[
                        order.id
                      ]

                        ? "⏳ Procesando..."

                        : "✓ Marcar como completado"}

                    </button>

                  )}


                  {order.status ===
                    "completed" && (

                    <span className="order-completed-label">
                      ✓ Stock actualizado
                    </span>

                  )}

                </div>

              </div>


            </article>

          ))

        )}

      </div>

    </div>
  )
}


export default OrdersAdmin