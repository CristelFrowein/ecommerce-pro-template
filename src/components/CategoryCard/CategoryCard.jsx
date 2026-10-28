import { Link } from "react-router-dom"
import "./CategoryCard.css"

function CategoryCard({ category }) {

  return (

    <Link
      to={`/categoria/${category.slug}`}
      className="category-card"
    >

      <img
        src={category.image}
        alt={category.name}
      />

      <div className="category-overlay">
        <h3>{category.name}</h3>
      </div>

    </Link>

  )

}

export default CategoryCard