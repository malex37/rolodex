import { parseNewRecipe } from '@rolodex/models'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'

const emptyIngredient = { name: '', quantity: '' }

export default function RecipeForm({ onSave, onCancel }) {
  const { client } = useAuth()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState([{ ...emptyIngredient }])
  const [steps, setSteps] = useState([''])
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [pageUri, setPageUri] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')

  // Fills the form from a recipe page (FeedRecipe) for review before saving.
  const handleFetch = async (event) => {
    event.preventDefault()
    setFetching(true)
    setFetchError('')
    try {
      const { recipe } = await client.feedRecipe({ uri: pageUri.trim() })
      setName(recipe.name)
      setCategory(recipe.category)
      setTags(recipe.tags.join(', '))
      setIngredients(recipe.ingredients.length ? recipe.ingredients : [{ ...emptyIngredient }])
      setSteps(recipe.steps.length ? recipe.steps : [''])
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetching(false)
    }
  }

  const updateIngredient = (index, field, value) =>
    setIngredients((list) =>
      list.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      await onSave(
        parseNewRecipe({
          name,
          category,
          tags: tags.split(','),
          ingredients,
          steps,
          private: isPrivate,
        }),
      )
    } catch (err) {
      setSaveError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="card grid gap-4">
      <h2 className="text-xl font-semibold">New recipe</h2>

      <form className="grid gap-1" onSubmit={handleFetch}>
        <label className="grid gap-1 text-sm font-medium">
          Get from page:
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-[1_1_16rem]"
              type="url"
              value={pageUri}
              onChange={(e) => setPageUri(e.target.value)}
              placeholder="https://cooking.nytimes.com/recipes/…"
              required
            />
            <button type="submit" className="btn" disabled={fetching}>
              {fetching ? 'Getting…' : 'Get recipe'}
            </button>
          </div>
        </label>
        {fetchError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {fetchError}
          </p>
        )}
      </form>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1 text-sm font-medium">
          Name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          Category
          <input
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Dinner"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium">
          Tags (comma separated)
          <input
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="quick, vegetarian"
          />
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Ingredients</legend>
          {ingredients.map((item, i) => (
            <div className="flex flex-wrap gap-2" key={i}>
              <input
                className="input flex-[2_1_10rem]"
                aria-label="Ingredient"
                placeholder="Ingredient"
                value={item.name}
                onChange={(e) => updateIngredient(i, 'name', e.target.value)}
              />
              <input
                className="input flex-[1_1_6rem]"
                aria-label="Quantity"
                placeholder="Quantity"
                value={item.quantity}
                onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn justify-self-start"
            onClick={() => setIngredients((list) => [...list, { ...emptyIngredient }])}
          >
            + Ingredient
          </button>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Cooking steps</legend>
          {steps.map((step, i) => (
            <textarea
              key={i}
              className="input min-h-16"
              aria-label={`Step ${i + 1}`}
              placeholder={`Step ${i + 1}`}
              value={step}
              onChange={(e) =>
                setSteps((list) => list.map((s, j) => (j === i ? e.target.value : s)))
              }
            />
          ))}
          <button
            type="button"
            className="btn justify-self-start"
            onClick={() => setSteps((list) => [...list, ''])}
          >
            + Step
          </button>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-orange-600"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <span>
            <span className="font-medium">Private</span>
            <span className="text-stone-500"> — only you can see it</span>
          </span>
        </label>

        {saveError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {saveError}
          </p>
        )}

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save recipe'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
