import { useState } from "react"
import LoginAdmin from "./LoginAdmin"
import AdminPanel from "./AdminPanel"

function AdminPage() {

  const [logged, setLogged] = useState(false)

  return logged
    ? <AdminPanel />
    : <LoginAdmin onLogin={() => setLogged(true)} />
}

export default AdminPage