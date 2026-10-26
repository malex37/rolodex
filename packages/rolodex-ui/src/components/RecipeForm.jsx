import { parseNewRecipe } from '@rolodex/models'
import { useState } from 'react'

const emptyIngredient = { name: '', quantity: '' }

export default function RecipeForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState([{ ...emptyIngredient }])
  const [steps, setSteps] = useState([''])

  const updateIngredient = (index, field, value) =>
    setIngredients((list) =>
      list.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!name.trim()) return
    onSave({
      id: crypto.randomUUID(),
      ...parseNewRecipe({ name, category, tags: tags.split(','), ingredients, steps }),
    })
  }

  return (
    <form className="card grid gap-4" onSubmit={handleSubmit}>
      <h2 className="text-xl font-semibold">New recipe</h2>

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

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">
          Save recipe
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
