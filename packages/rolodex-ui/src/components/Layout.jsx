import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive
      ? 'bg-orange-600 text-white'
      : 'hover:bg-stone-200 dark:hover:bg-stone-700'
  }`

export default function Layout() {
  const { email, signOut, client } = useAuth()
  // Recipes are shared through the API: every public recipe plus the user's
  // own private ones. null while loading.
  const [recipes, setRecipes] = useState(null)
  const [recipesError, setRecipesError] = useState('')
  // Shopping lists the user owns or that were shared with them. null while loading.
  const [lists, setLists] = useState(null)
  const [listsError, setListsError] = useState('')

  useEffect(() => {
    let cancelled = false
    client
      .listRecipes()
      .then(({ recipes }) => !cancelled && setRecipes(recipes))
      .catch((err) => !cancelled && setRecipesError(err.message))
    return () => {
      cancelled = true
    }
  }, [client])

  const reloadLists = useCallback(
    () =>
      client
        .listGroceryLists()
        .then(({ lists }) => {
          setLists(lists)
          setListsError('')
        })
        .catch((err) => setListsError(err.message)),
    [client],
  )

  useEffect(() => {
    reloadLists()
  }, [reloadLists])

  const createRecipe = async (newRecipe) => {
    const { recipe } = await client.createRecipe({ recipe: newRecipe })
    setRecipes((list) => [...(list ?? []), recipe])
    return recipe
  }

  const deleteRecipe = async (id) => {
    await client.deleteRecipe({ id })
    setRecipes((list) => list.filter((r) => r.id !== id))
  }

  const createList = async (name) => {
    const { list } = await client.createGroceryList({ name })
    setLists((current) => [...(current ?? []), list])
    return list
  }

  // Replaces (or, with null, removes) one list after a change.
  const updateList = (id, list) =>
    setLists((current) =>
      list ? current.map((l) => (l.id === id ? list : l)) : current.filter((l) => l.id !== id),
    )

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-4 pt-6 pb-16">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Rolodex</h1>
        <nav className="flex gap-2">
          <NavLink to="/recipes" className={navClass}>
            Recipes
          </NavLink>
          <NavLink to="/groceries" className={navClass}>
            Shopping lists
          </NavLink>
          <button type="button" className="btn" title={email ?? undefined} onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>

      <Outlet
        context={{
          recipes,
          recipesError,
          createRecipe,
          deleteRecipe,
          lists,
          listsError,
          reloadLists,
          createList,
          updateList,
        }}
      />
    </div>
  )
}
