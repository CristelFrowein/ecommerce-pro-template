import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react"

import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "firebase/firestore"

import { toast } from "react-toastify"

import { db } from "../../services/firebase"

import {
  formatMoney,
  getSelections,
  getStock,
  groupQuantities
} from "../../utils/cartUtils"

import "./OrdersAdmin.css"

// ==============================
// ESTADOS
// ==============================

const STATUS_LABELS = {
  pending: "Pendiente",
  completed: "Completado",
  cancelled: "Cancelado",
  unknown: "Estado desconocido"
}

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "completed", label: "Completados" },
  { value: "cancelled", label: "Cancelados" }
]

function getStatus(order) {
  // Compatibilidad con pedidos antiguos sin estado.
  if (
    order.status === undefined ||
    order.status === null ||
    order.status === ""
  ) {
    return "pending"
  }

  return ["pending", "completed", "cancelled"].includes(
    order.status
  )
    ? order.status
    : "unknown"
}

// ==============================
// FECHAS
// ==============================

const dateFormatter = new Intl.DateTimeFormat(
  "es-AR",
  {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  }
)

function getDate(value) {
  if (value === null || value === undefined) {
    return null
  }

  try {
    let date

    if (typeof value.toDate === "function") {
      date = value.toDate()
    } else if (value instanceof Date) {
      date = value
    } else if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      date = new Date(
        value.seconds * 1000 +
        (Number(value.nanoseconds) || 0) / 1000000
      )
    } else if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      date = new Date(value)
    }

    return date instanceof Date &&
      Number.isFinite(date.getTime())
      ? date
      : null
  } catch {
    return null
  }
}

function formatDate(value) {
  const date = getDate(value)

  return date
    ? dateFormatter.format(date)
    : "Sin fecha registrada"
}

function compareDates(a, b, order) {
  const dateA = getDate(a.createdAt)
  const dateB = getDate(b.createdAt)

  // Los pedidos sin fecha quedan al final.
  if (!dateA && !dateB) {
    return a.id.localeCompare(b.id)
  }

  if (!dateA) return 1
  if (!dateB) return -1

  const difference = order === "oldest"
    ? dateA.getTime() - dateB.getTime()
    : dateB.getTime() - dateA.getTime()

  return difference || a.id.localeCompare(b.id)
}

// ==============================
// BÚSQUEDA
// ==============================

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function matchesSearch(order, search) {
  const term = normalizeText(search)

  if (!term) return true

  const phone = String(
    order.customer?.phone ?? ""
  )

  const phoneDigits = phone.replace(/\D/g, "")

  const haystack = normalizeText(
    `${order.id} ${order.customer?.name ?? ""} ` +
    `${phone} ${phoneDigits}`
  )

  const matchesWords = term
    .split(" ")
    .every(word => haystack.includes(word))

  // Permite buscar teléfonos con espacios,
  // guiones, paréntesis o prefijo internacional.
  const digits = term.replace(/\D/g, "")

  const isPhoneSearch =
    /^[+\d\s().-]+$/.test(term) &&
    digits.length > 0

  return (
    matchesWords ||
    (isPhoneSearch && phoneDigits.includes(digits))
  )
}

function getItemPrice(item) {
  if (
    item.price === null ||
    item.price === undefined ||
    String(item.price).trim() === ""
  ) {
    return null
  }

  const price = Number(item.price)

  return Number.isFinite(price) && price >= 0
    ? price
    : null
}

// ==============================
// COMPONENTE
// ==============================

function OrdersAdmin({ onBack }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateOrder, setDateOrder] = useState("newest")

  const [processing, setProcessing] = useState({})

  const processingRef = useRef(new Set())

  const searchId = useId()
  const sortId = useId()

  // ==============================
  // PEDIDOS EN TIEMPO REAL
  // ==============================

  useEffect(() => {
    return onSnapshot(
      collection(db, "orders"),
      snapshot => {
        const data = snapshot.docs.map(document => ({
          ...document.data(),
          id: document.id
        }))

        setOrders(data)
        setError("")
        setLoading(false)
      },
      loadError => {
        console.error(
          "Error al cargar pedidos:",
          loadError
        )

        setError(
          "No se pudieron cargar los pedidos."
        )

        setLoading(false)
      }
    )
  }, [attempt])

  // ==============================
  // CONTADORES Y FILTROS
  // ==============================

  const counts = useMemo(() => {
    const result = {
      all: orders.length,
      pending: 0,
      completed: 0,
      cancelled: 0
    }

    for (const order of orders) {
      const status = getStatus(order)

      if (status !== "unknown") {
        result[status] += 1
      }
    }

    return result
  }, [orders])

  const filteredOrders = useMemo(() => {
    return orders
      .filter(order => {
        const matchesStatus =
          statusFilter === "all" ||
          getStatus(order) === statusFilter

        return (
          matchesStatus &&
          matchesSearch(order, search)
        )
      })
      .sort((a, b) =>
        compareDates(a, b, dateOrder)
      )
  }, [orders, search, statusFilter, dateOrder])

  const hasFilters =
    search !== "" ||
    statusFilter !== "all" ||
    dateOrder !== "newest"

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setDateOrder("newest")
  }

  function retryLoading() {
    setLoading(true)
    setError("")
    setAttempt(previous => previous + 1)
  }

  // ==============================
  // COMPLETAR O CANCELAR
  // ==============================

  async function changeOrderStatus(order, target) {
    if (
      !["completed", "cancelled"].includes(target) ||
      processingRef.current.has(order.id)
    ) {
      return
    }

    if (getStatus(order) !== "pending") {
      toast.info(
        "Solo se pueden modificar pedidos pendientes."
      )
      return
    }

    if (
      target === "cancelled" &&
      !window.confirm(
        `¿Cancelar el pedido ${order.id}?\n\n` +
        "No se descontará stock."
      )
    ) {
      return
    }

    processingRef.current.add(order.id)

    setProcessing(previous => ({
      ...previous,
      [order.id]: target
    }))

    try {
      const changed = await runTransaction(
        db,
        async transaction => {
          const orderRef = doc(
            db,
            "orders",
            order.id
          )

          const orderSnapshot =
            await transaction.get(orderRef)

          if (!orderSnapshot.exists()) {
            throw new Error(
              "El pedido ya no existe."
            )
          }

          const currentOrder = orderSnapshot.data()
          const currentStatus = getStatus(currentOrder)

          // Otro proceso pudo haber realizado
          // exactamente la misma operación.
          if (currentStatus === target) {
            return false
          }

          if (currentStatus !== "pending") {
            throw new Error(
              `El pedido ya no está pendiente. Estado actual: ${
                STATUS_LABELS[currentStatus]
              }.`
            )
          }

          // Cancelar un pendiente no toca productos.
          if (target === "cancelled") {
            transaction.update(orderRef, {
              status: "cancelled",
              cancelledAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            })

            return true
          }

          if (
            !Array.isArray(currentOrder.items) ||
            currentOrder.items.length === 0
          ) {
            throw new Error(
              "El pedido no tiene productos válidos."
            )
          }

          // Suma las variantes de cada producto.
          const quantities = groupQuantities(
            currentOrder.items
          )

          const updates = []

          // Primero todas las lecturas.
          for (const [productId, quantity] of quantities) {
            const productRef = doc(
              db,
              "products",
              productId
            )

            const productSnapshot =
              await transaction.get(productRef)

            if (!productSnapshot.exists()) {
              throw new Error(
                "Un producto del pedido ya no existe."
              )
            }

            const product = productSnapshot.data()
            const stock = getStock(product)

            if (quantity > stock) {
              throw new Error(
                `Stock insuficiente de "${product.name}". ` +
                `Disponible: ${stock}. Pedido: ${quantity}.`
              )
            }

            updates.push({
              ref: productRef,
              stock: stock - quantity
            })
          }

          // Después todas las escrituras.
          for (const update of updates) {
            transaction.update(update.ref, {
              stock: update.stock
            })
          }

          transaction.update(orderRef, {
            status: "completed",
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })

          return true
        }
      )

      if (!changed) {
        toast.info(
          target === "completed"
            ? "El pedido ya estaba completado."
            : "El pedido ya estaba cancelado."
        )

        return
      }

      toast.success(
        target === "completed"
          ? "Pedido completado. Stock actualizado."
          : "Pedido cancelado sin descontar stock."
      )
    } catch (actionError) {
      console.error(
        "Error al modificar pedido:",
        actionError
      )

      toast.error(
        actionError.message ||
        "No se pudo modificar el pedido."
      )
    } finally {
      processingRef.current.delete(order.id)

      setProcessing(previous => ({
        ...previous,
        [order.id]: false
      }))
    }
  }

  return (
    <div className="orders-admin">
      {/* TÍTULO */}
      <div className="orders-title">
        <div>
          <h2>Pedidos</h2>
          <p>
            Buscá, revisá y gestioná las compras.
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            className="orders-back"
            onClick={onBack}
          >
            ← Volver
          </button>
        )}
      </div>

      {/* FILTROS POR ESTADO */}
      <div
        className="orders-statistics"
        role="group"
        aria-label="Filtrar pedidos por estado"
      >
        {FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`orders-stat ${
              statusFilter === filter.value
                ? "is-active"
                : ""
            }`}
            aria-pressed={
              statusFilter === filter.value
            }
            disabled={loading || Boolean(error)}
            onClick={() =>
              setStatusFilter(filter.value)
            }
          >
            <span>{filter.label}</span>
            <strong>{counts[filter.value]}</strong>
          </button>
        ))}
      </div>

      {/* BÚSQUEDA Y ORDEN */}
      <div className="orders-toolbar">
        <div className="orders-search-field">
          <label htmlFor={searchId}>
            Buscar pedido
          </label>

          <input
            id={searchId}
            type="search"
            placeholder="Número, nombre o teléfono"
            autoComplete="off"
            value={search}
            disabled={loading || Boolean(error)}
            onChange={event =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="orders-sort-field">
          <label htmlFor={sortId}>
            Ordenar por fecha
          </label>

          <select
            id={sortId}
            value={dateOrder}
            disabled={loading || Boolean(error)}
            onChange={event =>
              setDateOrder(event.target.value)
            }
          >
            <option value="newest">
              Más recientes primero
            </option>

            <option value="oldest">
              Más antiguos primero
            </option>
          </select>
        </div>
      </div>

      {!loading && !error && (
        <div className="orders-results-bar">
          <p role="status">
            Mostrando {filteredOrders.length} de{" "}
            {orders.length}{" "}
            {orders.length === 1
              ? "pedido"
              : "pedidos"}
          </p>

          {hasFilters && (
            <button
              type="button"
              className="orders-clear"
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* CARGA / ERROR / VACÍO */}
      {loading ? (
        <p className="orders-loading" role="status">
          Cargando pedidos...
        </p>
      ) : error ? (
        <div className="orders-error">
          <p role="alert">{error}</p>

          <button
            type="button"
            className="orders-back"
            onClick={retryLoading}
          >
            Reintentar
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty">
          <span aria-hidden="true">📦</span>

          <h3>
            {orders.length === 0
              ? "No hay pedidos todavía"
              : "No encontramos pedidos"}
          </h3>

          <p>
            {orders.length === 0
              ? "Los nuevos pedidos aparecerán aquí."
              : "Probá con otra búsqueda o cambiá el filtro de estado."}
          </p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => {
            const status = getStatus(order)
            const action = processing[order.id]
            const isProcessing = Boolean(action)

            const customerName = String(
              order.customer?.name || "Cliente"
            )

            const items = Array.isArray(order.items)
              ? order.items.filter(
                  item =>
                    item &&
                    typeof item === "object"
                )
              : []

            const units = items.reduce((total, item) => {
              const quantity = Number(item.quantity)

              return total + (
                Number.isSafeInteger(quantity) &&
                quantity > 0
                  ? quantity
                  : 0
              )
            }, 0)

            const createdDate = getDate(
              order.createdAt
            )

            return (
              <article
                key={order.id}
                className="order-card"
                aria-busy={isProcessing}
              >
                {/* CLIENTE Y ESTADO */}
                <div className="order-header">
                  <div className="order-customer">
                    <div
                      className="customer-avatar"
                      aria-hidden="true"
                    >
                      {customerName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="order-customer-info">
                      <strong>{customerName}</strong>

                      <span>
                        {String(
                          order.customer?.phone ||
                          "Sin teléfono"
                        )}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`order-status status-${status}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </div>

                <div className="order-content">
                  {/* IDENTIFICACIÓN Y FECHA */}
                  <dl className="order-meta">
                    <div>
                      <dt>Número de pedido</dt>
                      <dd className="order-id">
                        {order.id}
                      </dd>
                    </div>

                    <div>
                      <dt>Fecha y hora</dt>
                      <dd>
                        {createdDate ? (
                          <time
                            dateTime={createdDate.toISOString()}
                          >
                            {formatDate(order.createdAt)}
                          </time>
                        ) : (
                          "Sin fecha registrada"
                        )}
                      </dd>
                    </div>
                  </dl>

                  {/* DETALLE DESPLEGABLE */}
                  <details className="order-details">
                    <summary>
                      Ver productos y datos de entrega
                    </summary>

                    <div className="order-details-body">
                      <dl className="order-delivery">
                        <div>
                          <dt>Teléfono</dt>
                          <dd>
                            {String(
                              order.customer?.phone ||
                              "No informado"
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>Dirección</dt>
                          <dd>
                            {String(
                              order.customer?.address ||
                              "No informada"
                            )}
                          </dd>
                        </div>

                        {order.customer?.email && (
                          <div>
                            <dt>Email</dt>
                            <dd>
                              {String(order.customer.email)}
                            </dd>
                          </div>
                        )}
                      </dl>

                      {order.notes && (
                        <div className="order-notes">
                          <strong>Notas del cliente</strong>
                          <p>{String(order.notes)}</p>
                        </div>
                      )}

                      <h3 className="order-section-title">
                        Productos
                      </h3>

                      {items.length === 0 ? (
                        <p>
                          No hay productos registrados.
                        </p>
                      ) : (
                        <ul className="order-items">
                          {items.map((item, index) => {
                            const price = getItemPrice(item)
                            const quantity = Number(
                              item.quantity
                            )

                            const validQuantity =
                              Number.isSafeInteger(quantity) &&
                              quantity > 0

                            const validAmount =
                              price !== null &&
                              validQuantity

                            return (
                              <li
                                key={`${
                                  item.cartItemId ||
                                  item.id ||
                                  "item"
                                }-${index}`}
                              >
                                <div className="order-item-info">
                                  <strong className="item-name">
                                    {String(
                                      item.name ||
                                      "Producto sin nombre"
                                    )}
                                  </strong>

                                  {Object.entries(
                                    getSelections(
                                      item.selectedAttributes
                                    )
                                  ).map(([name, value]) => (
                                    <span
                                      key={name}
                                      className="order-item-option"
                                    >
                                      {name}: {value}
                                    </span>
                                  ))}

                                  <span className="item-quantity">
                                    {validQuantity
                                      ? `${quantity} ${
                                          quantity === 1
                                            ? "unidad"
                                            : "unidades"
                                        }`
                                      : "Cantidad no válida"}

                                    {price !== null &&
                                      ` · ${formatMoney(price)} c/u`}
                                  </span>
                                </div>

                                <strong className="order-line-total">
                                  {validAmount
                                    ? formatMoney(
                                        price * quantity
                                      )
                                    : "Sin importe"}
                                </strong>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </details>
                </div>

                {/* TOTAL Y ACCIONES */}
                <div className="order-footer">
                  <div className="order-total">
                    <span>Total del pedido</span>

                    <strong>
                      {formatMoney(order.total)}
                    </strong>

                    <small>
                      {units}{" "}
                      {units === 1
                        ? "unidad"
                        : "unidades"}
                    </small>
                  </div>

                  <div className="order-actions">
                    {status === "pending" && (
                      <>
                        <button
                          type="button"
                          className="complete-button"
                          disabled={isProcessing}
                          onClick={() =>
                            changeOrderStatus(
                              order,
                              "completed"
                            )
                          }
                        >
                          {action === "completed"
                            ? "Completando..."
                            : "✓ Completar pedido"}
                        </button>

                        <button
                          type="button"
                          className="cancel-order-button"
                          disabled={isProcessing}
                          onClick={() =>
                            changeOrderStatus(
                              order,
                              "cancelled"
                            )
                          }
                        >
                          {action === "cancelled"
                            ? "Cancelando..."
                            : "Cancelar pedido"}
                        </button>
                      </>
                    )}

                    {status === "completed" && (
                      <div className="order-final-state">
                        <span className="order-completed-label">
                          ✓ Stock actualizado
                        </span>

                        {getDate(order.completedAt) && (
                          <small>
                            {formatDate(order.completedAt)}
                          </small>
                        )}
                      </div>
                    )}

                    {status === "cancelled" && (
                      <div className="order-final-state">
                        <span className="order-cancelled-label">
                          Pedido cancelado
                        </span>

                        {getDate(order.cancelledAt) && (
                          <small>
                            {formatDate(order.cancelledAt)}
                          </small>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default OrdersAdmin