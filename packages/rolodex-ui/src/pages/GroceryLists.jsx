import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { sharingSummary } from '../groceryLists.js'

export default function GroceryLists() {
  const { lists, listsError, createList } = useOutletContext()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const list = await createList(name.trim())
      navigate(`/groceries/${list.id}`)
    } catch (err) {
      setCreateError(err.message)
      setCreating(false)
    }
  }

  return (
    <div className="grid gap-4">
      <form className="grid gap-1" onSubmit={handleCreate}>
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-[2_1_12rem]"
            aria-label="List name"
            placeholder="New list, e.g. Weekly shop"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : '+ New list'}
          </button>
        </div>
        {createError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {createError}
          </p>
        )}
      </form>

      {listsError && (
        <p className="text-red-600 dark:text-red-400" role="alert">
          Couldn’t load shopping lists: {listsError}
        </p>
      )}
      {!lists && !listsError && <p className="text-stone-500">Loading shopping lists…</p>}
      {lists?.length === 0 && (
        <p className="text-stone-500">No shopping lists yet. Create one above.</p>
      )}

      {lists?.map((list) => (
        <Link
          key={list.id}
          to={`/groceries/${list.id}`}
          className="card block transition hover:border-orange-400"
        >
          <h3 className="font-semibold">{list.name}</h3>
          <p className="mt-1 text-sm text-stone-500">{sharingSummary(list)}</p>
        </Link>
      ))}
    </div>
  )
}
