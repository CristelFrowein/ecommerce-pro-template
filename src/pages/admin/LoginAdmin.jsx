import { useState } from "react"
import "./LoginAdmin.css"

const ADMIN_PASSWORD = "1234" // 🔥 cambiá esto

function LoginAdmin({ onLogin }) {

  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()

    if (password === ADMIN_PASSWORD) {
      onLogin()
    } else {
      setError(true)
    }
  }

  return (
    <div className="admin-login">

      <div className="admin-login-card">

        <div className="admin-login-header">
          <div className="admin-login-icon">
            🔐
          </div>

          <h2>Panel Admin</h2>
          <p>Ingresá para administrar tu tienda</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">

          <div className="admin-input-group">
            <label htmlFor="admin-password">
              Contraseña
            </label>

            <input
              id="admin-password"
              type="password"
              placeholder="Ingresá tu contraseña"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(false)
              }}
            />
          </div>

          {error && (
            <p className="admin-login-error">
              Contraseña incorrecta
            </p>
          )}

          <button type="submit">
            Ingresar
          </button>

        </form>

      </div>

    </div>
  )
}

export default LoginAdmin