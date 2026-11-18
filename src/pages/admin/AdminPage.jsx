import { useEffect, useState } from "react"
import { onIdTokenChanged, signOut } from "firebase/auth"
import { auth } from "../../services/firebase"
import LoginAdmin from "./LoginAdmin"
import AdminPanel from "./AdminPanel"

export default function AdminPage() {
  const [role, setRole] = useState("loading")

  useEffect(() => {
    let generation = 0
    const unsubscribe = onIdTokenChanged(auth, async user => {
      const current = ++generation
      let next = user ? "forbidden" : "guest"
      if (user) {
        const token = await user.getIdTokenResult().catch(() => null)
        if (token?.claims.admin === true) next = "admin"
      }
      if (current === generation) setRole(next)
    })
    return () => { generation++; unsubscribe() }
  }, [])

  if (role === "loading") return <p role="status">Verificando sesión…</p>
  if (role === "guest") return <LoginAdmin />
  return (
    <div className="container">
      <button className="admin-back" onClick={() => signOut(auth)}>Cerrar sesión</button>
      {role === "admin" ? <AdminPanel /> : <p role="alert">Tu cuenta no tiene acceso al panel.</p>}
    </div>
  )
}
