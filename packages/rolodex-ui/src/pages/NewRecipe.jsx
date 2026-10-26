import { useNavigate, useOutletContext } from 'react-router-dom'
import RecipeForm from '../components/RecipeForm.jsx'

export default function NewRecipe() {
  const { createRecipe } = useOutletContext()
  const navigate = useNavigate()

  return (
    <RecipeForm
      onSave={async (newRecipe) => {
        const recipe = await createRecipe(newRecipe)
        navigate(`/recipes/${recipe.id}`)
      }}
      onCancel={() => navigate('/recipes')}
    />
  )
}
