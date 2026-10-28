import "./Footer.css"
import { storeConfig } from "../../config/storeConfig"

function Footer(){

  return(

    <footer className="footer">

      <div className="container">

        <p>
          © {new Date().getFullYear()} {storeConfig.storeName}
        </p>

      </div>

    </footer>

  )
}

export default Footer