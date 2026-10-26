import { UNITS, formatAmount, parseNewRecipe, unitLabel } from '@rolodex/models'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'

// Form rows hold text: amount as typed ("1/4", "0.25"), unit "" until chosen.
const emptyIngredient = { name: '', amount: '', unit: '' }

// A saved ingredient or an imported draft (amount/unit may be missing) as a form row.
const toRow = (item) => ({
  name: item.name,
  amount: item.amount ? formatAmount(item.amount) : '',
  unit: item.unit ?? '',
})

const toRows = (items) => (items?.length ? items.map(toRow) : [{ ...emptyIngredient }])

// A decimal (0.25), fraction (1/4) or mixed number (1 1/2), for the browser's own check.
const AMOUNT_PATTERN = String.raw`\s*(\d+\s+\d+/\d+|\d+/\d+|\d*\.\d+|\d+)\s*`

// Creates a recipe, or edits `recipe` when given one.
export default function RecipeForm({ recipe: initial, onSave, onCancel }) {
  const { client } = useAuth()
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [ingredients, setIngredients] = useState(() => toRows(initial?.ingredients))
  const [steps, setSteps] = useState(initial?.steps.length ? initial.steps : [''])
  const [isPrivate, setIsPrivate] = useState(initial?.private ?? false)
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
      setIngredients(toRows(recipe.ingredients))
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
      <h2 className="text-xl font-semibold">{initial ? 'Edit recipe' : 'New recipe'}</h2>

      {/* Importing would overwrite the fields, so only offer it for new recipes. */}
      {!initial && (
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
      )}

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
          {ingredients.map((item, i) => {
            // Once a row is started, all three fields are required.
            const started = Boolean(item.name || item.amount || item.unit)
            return (
              <div className="flex flex-wrap gap-2" key={i}>
                <input
                  className="input flex-[1_1_5rem]"
                  aria-label={`Ingredient ${i + 1} amount`}
                  placeholder="1/4 or 0.25"
                  value={item.amount}
                  onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                  pattern={AMOUNT_PATTERN}
                  title="A number like 0.25, 1/4 or 1 1/2"
                  required={started}
                />
                <select
                  className="input flex-[1_1_7rem]"
                  aria-label={`Ingredient ${i + 1} unit`}
                  value={item.unit}
                  onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                  required={started}
                >
                  <option value="">Unit…</option>
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unitLabel(unit)}
                    </option>
                  ))}
                </select>
                <input
                  className="input flex-[3_1_10rem]"
                  aria-label={`Ingredient ${i + 1} name`}
                  placeholder="Ingredient"
                  value={item.name}
                  onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                  required={started}
                />
              </div>
            )
          })}
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
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Save recipe'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
