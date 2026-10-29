import { useEffect, useState } from "react"

import { subscribeContent } from "../services/contentService"

export function useProductCategories() {
  const [state, setState] = useState({
    categories: [],
    loading: true,
    error: ""
  })

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    return subscribeContent(
      "categories",
      result => {
        setState({
          categories: result.items.filter(
            category =>
              typeof category.slug === "string" &&
              category.slug
          ),
          loading: false,
          error: ""
        })
      },
      error => {
        console.error(
          "Error al cargar categorías:",
          error
        )

        setState(previous => ({
          ...previous,
          loading: false,
          error: "No pudimos cargar las categorías."
        }))
      }
    )
  }, [attempt])

  function retry() {
    setState(previous => ({
      ...previous,
      loading: true,
      error: ""
    }))

    setAttempt(previous => previous + 1)
  }

  function validateCategory(value) {
    if (state.loading) {
      throw new Error(
        "Esperá a que terminen de cargar las categorías."
      )
    }

    if (state.error) {
      throw new Error(
        "No se pudo verificar la categoría. Reintentá cargarla."
      )
    }

    const selected = state.categories.find(
      category => category.slug === value
    )

    if (!selected) {
      throw new Error(
        "Elegí una categoría válida de la lista."
      )
    }

    return selected.slug
  }

  return {
    ...state,
    retry,
    validateCategory
  }
}