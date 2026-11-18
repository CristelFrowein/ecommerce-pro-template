import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "../../services/firebase"
import "./LoginAdmin.css"

export default function LoginAdmin() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      await signInWithEmailAndPassword(auth, fields.get("email").trim(), fields.get("password"))
    } catch {
      setError("No pudimos iniciar sesión. Revisá tus datos y la configuración de Firebase.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="admin-login"><div className="admin-login-card">
    <div className="admin-login-header"><h2>Panel Admin</h2></div>
    <form className="admin-login-form" onSubmit={submit}>
      <div className="admin-input-group">
        <label htmlFor="admin-email">Correo electrónico</label>
        <input id="admin-email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="admin-input-group">
        <label htmlFor="admin-password">Contraseña</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <p className="admin-login-error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
    </form>
  </div></div>
}
