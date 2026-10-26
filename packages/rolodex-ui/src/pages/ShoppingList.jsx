import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'

export default function ShoppingList() {
  const { groceries: items, setGroceries, addGroceries } = useOutletContext()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!name.trim()) return
    addGroceries([{ name: name.trim(), quantity: quantity.trim() }])
    setName('')
    setQuantity('')
  }

  const toggle = (id) =>
    setGroceries((list) =>
      list.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    )

  return (
    <div className="grid gap-4">
      <form className="flex flex-wrap gap-2" onSubmit={handleSubmit}>
        <input
          className="input flex-[2_1_10rem]"
          aria-label="Item"
          placeholder="Item"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input flex-[1_1_6rem]"
          aria-label="Quantity"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-stone-500">Nothing to buy.</p>
      ) : (
        <ul className="card divide-y divide-stone-200 p-0 dark:divide-stone-700">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-2">
              <label
                className={`flex cursor-pointer items-center gap-3 ${
                  item.done ? 'text-stone-400 line-through' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-orange-600"
                  checked={item.done}
                  onChange={() => toggle(item.id)}
                />
                <span>
                  {item.quantity && <strong>{item.quantity} </strong>}
                  {item.name}
                </span>
              </label>
              <button
                type="button"
                className="rounded px-2 text-lg text-stone-400 hover:text-red-600"
                aria-label={`Remove ${item.name}`}
                onClick={() => setGroceries((list) => list.filter((i) => i.id !== item.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.some((item) => item.done) && (
        <button
          type="button"
          className="btn justify-self-start"
          onClick={() => setGroceries((list) => list.filter((item) => !item.done))}
        >
          Clear bought items
        </button>
      )}
    </div>
  )
}
