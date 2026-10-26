import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive
      ? 'bg-orange-600 text-white'
      : 'hover:bg-stone-200 dark:hover:bg-stone-700'
  }`

export default function Layout() {
  const { email, signOut } = useAuth()
  const [recipes, setRecipes] = useLocalStorage('rolodex.recipes', [])
  const [groceries, setGroceries] = useLocalStorage('rolodex.groceries', [])

  const addGroceries = (entries) =>
    setGroceries((list) => [
      ...list,
      ...entries.map(({ name, quantity }) => ({
        id: crypto.randomUUID(),
        name,
        quantity,
        done: false,
      })),
    ])

  const pendingCount = groceries.filter((item) => !item.done).length

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-4 pt-6 pb-16">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Rolodex</h1>
        <nav className="flex gap-2">
          <NavLink to="/recipes" className={navClass}>
            Recipes
          </NavLink>
          <NavLink to="/groceries" className={navClass}>
            Shopping list{pendingCount > 0 && ` (${pendingCount})`}
          </NavLink>
          <button type="button" className="btn" title={email ?? undefined} onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>

      <Outlet context={{ recipes, setRecipes, groceries, setGroceries, addGroceries }} />
    </div>
  )
}
