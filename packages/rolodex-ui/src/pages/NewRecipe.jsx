import { useNavigate, useOutletContext } from 'react-router-dom'
import RecipeForm from '../components/RecipeForm.jsx'

export default function NewRecipe() {
  const { setRecipes } = useOutletContext()
  const navigate = useNavigate()

  return (
    <RecipeForm
      onSave={(recipe) => {
        setRecipes((list) => [...list, recipe])
        navigate(`/recipes/${recipe.id}`)
      }}
      onCancel={() => navigate('/recipes')}
    />
  )
}
