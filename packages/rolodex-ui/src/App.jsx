import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth.jsx'
import Layout from './components/Layout.jsx'
import EditRecipe from './pages/EditRecipe.jsx'
import GroceryLists from './pages/GroceryLists.jsx'
import Login from './pages/Login.jsx'
import NewRecipe from './pages/NewRecipe.jsx'
import NotFound from './pages/NotFound.jsx'
import RecipeDetail from './pages/RecipeDetail.jsx'
import Recipes from './pages/Recipes.jsx'
import ShoppingList from './pages/ShoppingList.jsx'

function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/recipes" replace />} />
        <Route path="recipes">
          <Route index element={<Recipes />} />
          <Route path="new" element={<NewRecipe />} />
          <Route path=":id" element={<RecipeDetail />} />
          <Route path=":id/edit" element={<EditRecipe />} />
        </Route>
        <Route path="groceries">
          <Route index element={<GroceryLists />} />
          <Route path=":listId" element={<ShoppingList />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
