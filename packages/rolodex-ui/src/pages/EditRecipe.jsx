import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import RecipeForm from '../components/RecipeForm.jsx'

export default function EditRecipe() {
  const { id } = useParams()
  const { recipes, recipesError, updateRecipe } = useOutletContext()
  const navigate = useNavigate()
  const recipe = recipes?.find((r) => r.id === id)

  if (!recipes && !recipesError) return <p className="text-stone-500">Loading recipe…</p>

  // Only the owner can edit; ownerless (older) recipes by anyone.
  if (!recipe || !(recipe.mine || !recipe.ownerId)) {
    return (
      <div className="grid gap-3">
        <p>{recipe ? 'Only the recipe’s owner can edit it.' : 'Recipe not found.'}</p>
        <Link to={recipe ? `/recipes/${id}` : '/recipes'} className="btn justify-self-start">
          ← Back
        </Link>
      </div>
    )
  }

  return (
    <RecipeForm
      recipe={recipe}
      onSave={async (changes) => {
        await updateRecipe(id, changes)
        navigate(`/recipes/${id}`)
      }}
      onCancel={() => navigate(`/recipes/${id}`)}
    />
  )
}
