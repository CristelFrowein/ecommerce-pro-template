import { auth } from "./firebase"

export async function postJson(path, body, options = {}) {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    signal: options.signal,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: JSON.stringify(body)
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.message || "No pudimos conectar con la tienda.")
  return data
}

export const checkoutQuote = (input, signal) => postJson("/api/create-checkout", { action: "quote", ...input }, { signal })

export async function changeOrder(input) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error("Volvé a iniciar sesión.")
  return postJson("/api/orders", input, { headers: { Authorization: `Bearer ${token}` } })
}
