import { useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import PrivateBadge from '../components/PrivateBadge.jsx'

export default function RecipeDetail() {
  const { id } = useParams()
  const { recipes, recipesError, deleteRecipe, addGroceries } = useOutletContext()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const recipe = recipes?.find((r) => r.id === id)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteRecipe(id)
      navigate('/recipes')
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  if (!recipes && !recipesError) {
    return <p className="text-stone-500">Loading recipe…</p>
  }

  if (!recipe) {
    return (
      <div className="grid gap-3">
        <p>Recipe not found.</p>
        <Link to="/recipes" className="btn justify-self-start">
          ← Back to recipes
        </Link>
      </div>
    )
  }

  return (
    <article className="grid gap-4">
      <Link to="/recipes" className="text-sm text-orange-700 hover:underline dark:text-orange-300">
        ← All recipes
      </Link>

      <div className="card grid gap-4">
        <header>
          <p className="text-sm text-stone-500">{recipe.category}</p>
          <h2 className="text-2xl font-bold">
            {recipe.name}
            {recipe.private && <PrivateBadge />}
          </h2>
          {recipe.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {recipe.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    to={`/recipes?q=${encodeURIComponent(tag)}`}
                    className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-200"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        {recipe.ingredients.length > 0 && (
          <section>
            <h3 className="mb-2 font-semibold">Ingredients</h3>
            <ul className="list-disc space-y-1 pl-5">
              {recipe.ingredients.map((item, i) => (
                <li key={i}>
                  {item.quantity && <strong>{item.quantity} </strong>}
                  {item.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {recipe.steps.length > 0 && (
          <section>
            <h3 className="mb-2 font-semibold">Cooking</h3>
            <ol className="list-decimal space-y-2 pl-5">
              {recipe.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={recipe.ingredients.length === 0}
            onClick={() => {
              addGroceries(recipe.ingredients)
              navigate('/groceries')
            }}
          >
            Add to groceries
          </button>
          {/* Only the owner can delete; ownerless (older) recipes by anyone. */}
          {(recipe.mine || !recipe.ownerId) && (
            <button type="button" className="btn" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
        {deleteError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {deleteError}
          </p>
        )}
      </div>
    </article>
  )
}
