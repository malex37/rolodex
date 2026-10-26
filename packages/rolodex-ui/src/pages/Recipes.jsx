import { useMemo } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'

export default function Recipes() {
  const { recipes } = useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''

  const setParam = (key, value) =>
    setSearchParams(
      (params) => {
        if (value) params.set(key, value)
        else params.delete(key)
        return params
      },
      { replace: true },
    )

  const categories = useMemo(
    () => [...new Set(recipes.map((recipe) => recipe.category))].sort(),
    [recipes],
  )

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const groups = {}
    for (const recipe of recipes) {
      if (category && recipe.category !== category) continue
      if (
        q &&
        !recipe.name.toLowerCase().includes(q) &&
        !recipe.tags.some((tag) => tag.includes(q))
      )
        continue
      ;(groups[recipe.category] ??= []).push(recipe)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [recipes, query, category])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          className="input flex-[2_1_12rem]"
          aria-label="Search recipes"
          placeholder="Search by name or tag"
          value={query}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <select
          className="input flex-[1_1_8rem]"
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setParam('category', e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <Link to="/recipes/new" className="btn btn-primary">
          + New recipe
        </Link>
      </div>

      {recipes.length === 0 && (
        <p className="text-stone-500">No recipes yet. Add your first one!</p>
      )}
      {recipes.length > 0 && grouped.length === 0 && (
        <p className="text-stone-500">No recipes match.</p>
      )}

      {grouped.map(([name, items]) => (
        <section key={name} className="grid gap-3">
          <h2 className="text-lg font-semibold">{name}</h2>
          {items.map((recipe) => (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className="card block transition hover:border-orange-400"
            >
              <h3 className="font-semibold">{recipe.name}</h3>
              <p className="mt-1 text-sm text-stone-500">
                {recipe.ingredients.length} ingredients · {recipe.steps.length} steps
              </p>
              {recipe.tags.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1">
                  {recipe.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
                    >
                      #{tag}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </section>
      ))}
    </div>
  )
}
