import { canConvert, convertQuantity, formatQuantity } from '@rolodex/models'
import { useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import Menu from '../components/Menu.jsx'
import PrivateBadge from '../components/PrivateBadge.jsx'

export default function RecipeDetail() {
  const { id } = useParams()
  const { client } = useAuth()
  const { recipes, recipesError, deleteRecipe, lists, createList } = useOutletContext()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [chosenListId, setChosenListId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  // null shows the recipe's own units; 'metric' or 'imperial' converts them for display.
  const [system, setSystem] = useState(null)
  const recipe = recipes?.find((r) => r.id === id)
  const listId = chosenListId || lists?.[0]?.id || ''

  // Adds the ingredients to the chosen list, creating a first list if needed.
  const handleAddToList = async () => {
    setAdding(true)
    setAddError('')
    try {
      const targetId = listId || (await createList('Shopping list')).id
      await client.addGroceries({
        listId: targetId,
        items: recipe.ingredients.map((item) => ({ name: item.name, quantity: formatQuantity(item) })),
      })
      navigate(`/groceries/${targetId}`)
    } catch (err) {
      setAddError(err.message)
      setAdding(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete “${recipe.name}”?`)) return
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

  // Offer each system only if converting would change some ingredient.
  const convertible = (target) => recipe.ingredients.some((item) => canConvert(item, target))
  const menuItems = [
    ...[
      ['metric', 'Show metric units'],
      ['imperial', 'Show imperial units'],
    ]
      .filter(([target]) => target !== system && convertible(target))
      .map(([target, label]) => ({ label, onSelect: () => setSystem(target) })),
    ...(system ? [{ label: 'Show original units', onSelect: () => setSystem(null) }] : []),
    // Only the owner can edit or delete; ownerless (older) recipes by anyone.
    ...(recipe.mine || !recipe.ownerId
      ? [
          { label: 'Edit', onSelect: () => navigate(`/recipes/${id}/edit`) },
          { label: deleting ? 'Deleting…' : 'Delete', onSelect: handleDelete, danger: true },
        ]
      : []),
  ]

  return (
    <article className="grid gap-4">
      <Link to="/recipes" className="text-sm text-orange-700 hover:underline dark:text-orange-300">
        ← All recipes
      </Link>

      <div className="card grid gap-4">
        <header>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-stone-500">{recipe.category}</p>
              <h2 className="text-2xl font-bold">
                {recipe.name}
                {recipe.private && <PrivateBadge />}
              </h2>
            </div>
            {menuItems.length > 0 && <Menu label="Recipe actions" items={menuItems} />}
          </div>
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
            {system && (
              <p className="mb-2 text-sm text-stone-500">
                Converted to {system} units (approximate).{' '}
                <button
                  type="button"
                  className="text-orange-700 hover:underline dark:text-orange-300"
                  onClick={() => setSystem(null)}
                >
                  Show original
                </button>
              </p>
            )}
            <ul className="list-disc space-y-1 pl-5">
              {recipe.ingredients.map((item, i) => (
                <li key={i}>
                  <strong>{formatQuantity(system ? convertQuantity(item, system) : item)} </strong>
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
          {lists?.length > 1 && (
            <select
              className="input w-auto"
              aria-label="Shopping list"
              value={listId}
              onChange={(e) => setChosenListId(e.target.value)}
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={recipe.ingredients.length === 0 || !lists || adding}
            onClick={handleAddToList}
          >
            {adding
              ? 'Adding…'
              : lists?.length === 1
                ? `Add to ${lists[0].name}`
                : lists?.length === 0
                  ? 'Add to a new shopping list'
                  : 'Add to list'}
          </button>
        </div>
        {addError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {addError}
          </p>
        )}
        {deleteError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {deleteError}
          </p>
        )}
      </div>
    </article>
  )
}
