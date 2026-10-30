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

const PAYMENT_LABELS = {
  approved: "Aprobado",
  pending: "Pendiente de pago",
  in_process: "En proceso",
  authorized: "Autorizado, sin cobro confirmado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
  charged_back: "Contracargo",
  in_mediation: "En revisión",
  unknown: "Estado desconocido"
}

function getStatus(order) {
  if (order.status == null || order.status === "") {
    return "pending"
  }

  return ["pending", "completed", "cancelled"].includes(
    order.status
  )
    ? order.status
    : "unknown"
}

function isMercadoPago(order) {
  return (
    order.paymentMethod === "mercadopago" ||
    String(order.id || "").startsWith("mp_") ||
    Boolean(order.preferenceId)
  )
}

function getPaymentInfo(order) {
  if (!isMercadoPago(order)) {
    const legacy =
      order.paymentMethod == null ||
      order.paymentMethod === ""

    if (legacy || order.paymentMethod === "whatsapp") {
      return {
        isMercadoPago: false,
        method: "WhatsApp",
        label: "A coordinar",
        tone: "neutral",
        group: "whatsapp",
        canComplete: true,
        reason:
          "El pago se coordina con el cliente por WhatsApp."
      }
    }

    return {
      isMercadoPago: false,
      method: "Método no reconocido",
      label: "Revisar método",
      tone: "warning",
      group: "review",
      canComplete: false,
      reason:
        "Revisá el método de pago antes de completar este pedido."
    }
  }

  const method = order.paymentMode === "test"
    ? "Mercado Pago · DEMO"
    : "Mercado Pago"

  if (order.paymentReviewRequired === true) {
    return {
      isMercadoPago: true,
      method,
      label: "Revisión requerida",
      tone: "warning",
      group: "review",
      canComplete: false,
      reason:
        "Este pago requiere revisión. No completes el pedido hasta resolverla."
    }
  }

  if (order.paymentVerified !== true) {
    const failed = order.checkoutState === "failed"

    return {
      isMercadoPago: true,
      method,
      label: failed
        ? "Checkout no iniciado"
        : "Sin verificar",
      tone: failed ? "danger" : "warning",
      group: failed ? "failed" : "waiting",
      canComplete: false,
      reason: failed
        ? "El checkout no se pudo iniciar. El pedido no tiene un pago aprobado verificado."
        : "Todavía no hay una confirmación verificada del pago. Podés consultar su estado."
    }
  }

  const status = order.paymentStatus

  const validPaymentId = /^\d{1,30}$/.test(
    String(order.paymentId || "")
  )

  if (status === "approved" && !validPaymentId) {
    return {
      isMercadoPago: true,
      method,
      label: "Aprobación incompleta",
      tone: "warning",
      group: "review",
      canComplete: false,
      reason:
        "Falta un identificador de pago válido. Revisá la verificación antes de completar."
    }
  }

  const canComplete =
    status === "approved" && validPaymentId

  const waiting = [
    "pending",
    "in_process",
    "authorized"
  ].includes(status)

  const failed = [
    "rejected",
    "cancelled"
  ].includes(status)

  const refunded = [
    "refunded",
    "partially_refunded"
  ].includes(status)

  const group = canComplete
    ? "approved"
    : waiting
      ? "waiting"
      : failed
        ? "failed"
        : refunded
          ? "refunded"
          : "review"

  return {
    isMercadoPago: true,
    method,
    label:
      PAYMENT_LABELS[status] ||
      PAYMENT_LABELS.unknown,
    tone: canComplete
      ? "success"
      : failed
        ? "danger"
        : "warning",
    group,
    canComplete,
    reason: canComplete
      ? "Pago aprobado y verificado. El estado del pedido se gestiona por separado."
      : "Para completar este pedido, el pago debe estar aprobado, verificado y sin revisiones pendientes."
  }
}

function needsPaymentReviewOnCancellation(order) {
  return isMercadoPago(order) && (
    order.paymentReviewRequired === true ||
    (
      order.paymentVerified === true &&
      [
        "approved",
        "partially_refunded",
        "authorized",
        "in_mediation",
        "charged_back"
      ].includes(order.paymentStatus)
    )
  )
}

const dateFormatter = new Intl.DateTimeFormat(
  "es-AR",
  {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  }
)

function getDate(value) {
  if (value == null) return null

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

  const phone = String(order.customer?.phone ?? "")
  const phoneDigits = phone.replace(/\D/g, "")

  const haystack = normalizeText(
    `${order.id} ${order.paymentId ?? ""} ` +
    `${order.customer?.name ?? ""} ` +
    `${phone} ${phoneDigits}`
  )

  const words = term
    .split(" ")
    .every(word => haystack.includes(word))

  const digits = term.replace(/\D/g, "")

  const isPhoneSearch =
    /^[+\d\s().-]+$/.test(term) &&
    digits.length > 0

  return (
    words ||
    (isPhoneSearch && phoneDigits.includes(digits))
  )
}

function getItemPrice(item) {
  if (
    item.price == null ||
    String(item.price).trim() === ""
  ) {
    return null
  }

  const price = Number(item.price)

  return Number.isFinite(price) && price >= 0
    ? price
    : null
}

function OrdersAdmin({ onBack }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateOrder, setDateOrder] = useState("newest")
  const [paymentFilter, setPaymentFilter] = useState("all")

  const [processing, setProcessing] = useState({})
  const processingRef = useRef(new Set())

  const searchId = useId()
  const sortId = useId()
  const paymentFilterId = useId()

  useEffect(() => {
    return onSnapshot(
      collection(db, "orders"),
      snapshot => {
        setOrders(
          snapshot.docs.map(document => ({
            ...document.data(),
            id: document.id
          }))
        )

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
      .filter(order =>
        (
          statusFilter === "all" ||
          getStatus(order) === statusFilter
        ) &&
        (
          paymentFilter === "all" ||
          getPaymentInfo(order).group === paymentFilter
        ) &&
        matchesSearch(order, search)
      )
      .sort((a, b) =>
        compareDates(a, b, dateOrder)
      )
  }, [
    orders,
    search,
    statusFilter,
    paymentFilter,
    dateOrder
  ])

  const hasFilters =
    search !== "" ||
    statusFilter !== "all" ||
    dateOrder !== "newest" ||
    paymentFilter !== "all"

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setDateOrder("newest")
    setPaymentFilter("all")
  }

  function retryLoading() {
    setLoading(true)
    setError("")
    setAttempt(previous => previous + 1)
  }

  function finishProcessing(orderId) {
    processingRef.current.delete(orderId)

    setProcessing(previous => ({
      ...previous,
      [orderId]: false
    }))
  }

  async function refreshPayment(order) {
    if (processingRef.current.has(order.id)) return

    processingRef.current.add(order.id)

    setProcessing(previous => ({
      ...previous,
      [order.id]: "payment"
    }))

    try {
      const response = await fetch(
        `/api/payment-status?order=${encodeURIComponent(order.id)}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(20000)
        }
      )

      const data = await response
        .json()
        .catch(() => null)

      if (!response.ok || !data) {
        throw new Error(
          data?.message ||
          "No se pudo consultar el pago."
        )
      }

      if (
        data.orderId !== order.id ||
        data.mode !== "test"
      ) {
        throw new Error(
          "La respuesta no corresponde a este pedido de prueba."
        )
      }

      if (data.reviewRequired) {
        toast.warning(
          "El pago requiere revisión."
        )
      } else if (
        data.verified &&
        data.paymentStatus === "approved"
      ) {
        toast.success(
          "Pago aprobado y verificado."
        )
      } else {
        const label = data.verified
          ? PAYMENT_LABELS[data.paymentStatus] ||
            "Desconocido"
          : "Sin verificar"

        toast.info(`Estado del pago: ${label}.`)
      }
    } catch (paymentError) {
      toast.error(
        paymentError.name === "TimeoutError"
          ? "La consulta tardó demasiado. Intentá nuevamente."
          : paymentError.message ||
            "No se pudo consultar el pago."
      )
    } finally {
      finishProcessing(order.id)
    }
  }

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

    const payment = getPaymentInfo(order)

    if (
      target === "completed" &&
      !payment.canComplete
    ) {
      toast.warning(payment.reason)
      return
    }

    const cancellationNeedsReview =
      needsPaymentReviewOnCancellation(order)

    if (target === "cancelled") {
      const warning = cancellationNeedsReview
        ? "Este pedido tiene un pago que requiere atención. Cancelar el pedido NO realiza un reembolso en Mercado Pago. Revisá el pago y gestioná la devolución que corresponda.\n\nNo se descontará stock."
        : payment.isMercadoPago
          ? "No se descontará stock. Cancelar el pedido no realiza devoluciones en Mercado Pago."
          : "No se descontará stock."

      if (
        !window.confirm(
          `¿Cancelar el pedido ${order.id}?\n\n${warning}`
        )
      ) {
        return
      }
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

          const currentOrder = {
            ...orderSnapshot.data(),
            id: order.id
          }

          const currentStatus =
            getStatus(currentOrder)

          if (currentStatus === target) {
            return false
          }

          if (currentStatus !== "pending") {
            throw new Error(
              `El pedido ya no está pendiente. Estado actual: ${STATUS_LABELS[currentStatus]}.`
            )
          }

          if (target === "cancelled") {
            const needsReview =
              needsPaymentReviewOnCancellation(
                currentOrder
              )

            if (
              needsReview &&
              !cancellationNeedsReview
            ) {
              throw new Error(
                "El estado del pago cambió. Revisá el pedido y volvé a cancelar para confirmar el aviso correspondiente."
              )
            }

            transaction.update(orderRef, {
              status: "cancelled",
              cancelledAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              ...(
                needsReview
                  ? { paymentReviewRequired: true }
                  : {}
              )
            })

            return true
          }

          // Revisamos el pago actualizado dentro
          // de la misma transacción del stock.
          const currentPayment =
            getPaymentInfo(currentOrder)

          if (!currentPayment.canComplete) {
            throw new Error(
              currentPayment.reason
            )
          }

          if (
            !Array.isArray(currentOrder.items) ||
            currentOrder.items.length === 0
          ) {
            throw new Error(
              "El pedido no tiene productos válidos."
            )
          }

          const quantities = groupQuantities(
            currentOrder.items
          )

          const updates = []

          // Primero todas las lecturas.
          for (
            const [productId, quantity] of quantities
          ) {
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
                `Stock insuficiente de "${product.name}". Disponible: ${stock}. Pedido: ${quantity}.`
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
          : "Pedido cancelado sin descontar stock. No se realizaron reembolsos."
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
      finishProcessing(order.id)
    }
  }

  return (
    <div className="orders-admin">
      <div className="orders-title">
        <div>
          <h2>Pedidos</h2>
          <p>
            Gestioná los pedidos y revisá sus pagos
            por separado.
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

      <div
        className="orders-statistics"
        role="group"
        aria-label="Filtrar por estado del pedido"
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

      <div className="orders-toolbar">
        <div className="orders-search-field">
          <label htmlFor={searchId}>
            Buscar pedido
          </label>

          <input
            id={searchId}
            type="search"
            placeholder="Pedido, pago, nombre o teléfono"
            autoComplete="off"
            value={search}
            disabled={loading || Boolean(error)}
            onChange={event =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="orders-payment-filter-field">
          <label htmlFor={paymentFilterId}>
            Filtrar por pago
          </label>

          <select
            id={paymentFilterId}
            value={paymentFilter}
            disabled={loading || Boolean(error)}
            onChange={event =>
              setPaymentFilter(event.target.value)
            }
          >
            <option value="all">
              Todos los pagos
            </option>
            <option value="approved">
              Aprobados y verificados
            </option>
            <option value="waiting">
              Pendientes / sin verificar
            </option>
            <option value="failed">
              Rechazados / cancelados / fallidos
            </option>
            <option value="refunded">
              Reembolsados / parciales
            </option>
            <option value="review">
              Requieren revisión
            </option>
            <option value="whatsapp">
              A coordinar por WhatsApp
            </option>
          </select>
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
              : "Probá con otra búsqueda o cambiá los filtros."}
          </p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => {
            const status = getStatus(order)
            const payment = getPaymentInfo(order)
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

            const units = items.reduce(
              (total, item) => {
                const quantity = Number(item.quantity)

                return total + (
                  Number.isSafeInteger(quantity) &&
                  quantity > 0
                    ? quantity
                    : 0
                )
              },
              0
            )

            const createdDate = getDate(
              order.createdAt
            )

            const canRefresh =
              payment.isMercadoPago &&
              order.paymentMode === "test" &&
              /^mp_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                order.id
              )

            const blockedId =
              `payment-note-${order.id}`

            return (
              <article
                key={order.id}
                className="order-card"
                aria-busy={isProcessing}
              >
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

                  <div className="order-status-group">
                    <span
                      className={`order-status status-${status}`}
                    >
                      Pedido: {STATUS_LABELS[status]}
                    </span>

                    <span
                      className={`order-payment-status payment-${payment.tone}`}
                    >
                      Pago: {payment.label}
                    </span>
                  </div>
                </div>

                <div className="order-content">
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
                            dateTime={
                              createdDate.toISOString()
                            }
                          >
                            {formatDate(
                              order.createdAt
                            )}
                          </time>
                        ) : (
                          "Sin fecha registrada"
                        )}
                      </dd>
                    </div>
                  </dl>

                  <section
                    className="order-payment"
                    aria-label="Información del pago"
                  >
                    <div className="order-payment-heading">
                      <strong>
                        {payment.method}
                      </strong>

                      {canRefresh && (
                        <button
                          type="button"
                          className="order-refresh-payment"
                          disabled={isProcessing}
                          onClick={() =>
                            refreshPayment(order)
                          }
                        >
                          {action === "payment"
                            ? "Consultando..."
                            : "Actualizar pago"}
                        </button>
                      )}
                    </div>

                    <p
                      id={blockedId}
                      className={`order-payment-note ${
                        !payment.canComplete
                          ? "payment-note-warning"
                          : ""
                      }`}
                    >
                      {payment.reason}
                    </p>

                    {payment.isMercadoPago && (
                      <dl className="order-payment-meta">
                        <div>
                          <dt>Estado informado</dt>
                          <dd>
                            {order.paymentVerified === true
                              ? PAYMENT_LABELS[
                                  order.paymentStatus
                                ] || "Desconocido"
                              : "Sin verificar"}
                          </dd>
                        </div>

                        <div>
                          <dt>ID del pago</dt>
                          <dd className="order-id">
                            {String(
                              order.paymentId ||
                              "Todavía no registrado"
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>Verificación</dt>
                          <dd>
                            {order.paymentVerified === true
                              ? formatDate(
                                  order.paymentVerifiedAt
                                )
                              : "Pendiente de verificación"}
                          </dd>
                        </div>
                      </dl>
                    )}

                    {status === "cancelled" &&
                      payment.isMercadoPago && (
                        <p className="order-refund-note">
                          Cancelar el pedido no realiza
                          un reembolso. Revisá el estado
                          del pago y gestioná la devolución
                          que corresponda en Mercado Pago.
                        </p>
                      )}
                  </section>

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
                              {String(
                                order.customer.email
                              )}
                            </dd>
                          </div>
                        )}
                      </dl>

                      {order.notes && (
                        <div className="order-notes">
                          <strong>
                            Notas del cliente
                          </strong>
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
                            const price =
                              getItemPrice(item)

                            const quantity = Number(
                              item.quantity
                            )

                            const validQuantity =
                              Number.isSafeInteger(
                                quantity
                              ) &&
                              quantity > 0

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
                                  ).map(
                                    ([name, value]) => (
                                      <span
                                        key={name}
                                        className="order-item-option"
                                      >
                                        {name}: {value}
                                      </span>
                                    )
                                  )}

                                  <span className="item-quantity">
                                    {validQuantity
                                      ? `${quantity} ${
                                          quantity === 1
                                            ? "unidad"
                                            : "unidades"
                                        }`
                                      : "Cantidad no válida"}

                                    {price !== null &&
                                      ` · ${formatMoney(
                                        price
                                      )} c/u`}
                                  </span>
                                </div>

                                <strong className="order-line-total">
                                  {price !== null &&
                                  validQuantity
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
                          disabled={
                            isProcessing ||
                            !payment.canComplete
                          }
                          aria-describedby={
                            !payment.canComplete
                              ? blockedId
                              : undefined
                          }
                          title={
                            !payment.canComplete
                              ? payment.reason
                              : "Completar y descontar stock"
                          }
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

                        {getDate(
                          order.completedAt
                        ) && (
                          <small>
                            {formatDate(
                              order.completedAt
                            )}
                          </small>
                        )}
                      </div>
                    )}

                    {status === "cancelled" && (
                      <div className="order-final-state">
                        <span className="order-cancelled-label">
                          Pedido cancelado
                        </span>

                        {getDate(
                          order.cancelledAt
                        ) && (
                          <small>
                            {formatDate(
                              order.cancelledAt
                            )}
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