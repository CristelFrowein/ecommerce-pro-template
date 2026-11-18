import { getSelectableAttributes } from "../../utils/cartUtils"
import "./CommerceAdmin.css"

export default function ProductCommerceFields({ product, onChange }) {
  const options = getSelectableAttributes(product)
  const variants = product.variants || []
  function changeVariant(id, patch) {
    onChange("variants", variants.map(variant => variant.id === id ? { ...variant, ...patch } : variant))
  }

  return <details className="commerce-admin">
    <summary>SKU, ofertas, destacados y stock por variante</summary>
    <div className="commerce-admin-grid">
      <label>SKU<input value={product.sku || ""} maxLength={80} onChange={event => onChange("sku", event.target.value)} /></label>
      <label>Precio anterior<input type="number" min="0" step="0.01" value={product.oldPrice ?? ""} onChange={event => onChange("oldPrice", event.target.value)} /></label>
      <label>Oferta desde<input type="date" value={product.offerFrom || ""} onChange={event => onChange("offerFrom", event.target.value)} /></label>
      <label>Oferta hasta (inclusive)<input type="date" value={product.offerTo || ""} onChange={event => onChange("offerTo", event.target.value)} /></label>
      <label className="commerce-admin-check"><input type="checkbox" checked={product.featured === true} onChange={event => onChange("featured", event.target.checked)} /> Mostrar en destacados</label>
    </div>
    <p className="commerce-admin-small">Si cargás variantes, el stock de cada combinación reemplaza el stock general. Fuera de la vigencia se usa el precio anterior.</p>
    {variants.map((variant, index) => <div className="commerce-admin-row" key={variant.id}>
      <strong>Combinación {index + 1}</strong>
      <div className="commerce-admin-grid">
        {options.map(attribute => <label key={attribute.name}>{attribute.name}
          <select value={variant.options?.[attribute.name] || ""} onChange={event =>
            changeVariant(variant.id, { options: { ...variant.options, [attribute.name]: event.target.value } })}>
            <option value="">Elegir</option>
            {attribute.options?.filter(Boolean).map((option, optionIndex) => <option key={optionIndex} value={option}>{option}</option>)}
          </select>
        </label>)}
        <label>Stock<input type="number" min="0" step="1" value={variant.stock} onChange={event => changeVariant(variant.id, { stock: event.target.value })} /></label>
        <label>SKU de variante<input value={variant.sku || ""} maxLength={80} onChange={event => changeVariant(variant.id, { sku: event.target.value })} /></label>
        <label>URL de imagen<input type="url" value={variant.image || ""} onChange={event => changeVariant(variant.id, { image: event.target.value })} /></label>
      </div>
      <button type="button" onClick={() => onChange("variants", variants.filter(item => item.id !== variant.id))}>Quitar combinación</button>
    </div>)}
    <button type="button" disabled={!options.length || variants.length >= 100} onClick={() => onChange("variants",
      [...variants, { id: crypto.randomUUID(), options: {}, stock: 0, sku: "", image: "" }])}>Agregar combinación</button>
  </details>
}
