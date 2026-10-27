import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { sharingSummary } from '../groceryLists.js'

const errorClass = 'text-sm text-red-600 dark:text-red-400'

export default function ShoppingList() {
  const { listId } = useParams()
  const { client, email } = useAuth()
  const { lists, listsError, updateList } = useOutletContext()
  const navigate = useNavigate()
  const list = lists?.find((l) => l.id === listId)

  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [sharing, setSharing] = useState(false)
  // The item being dragged by its handle.
  const [dragId, setDragId] = useState(null)
  const listRef = useRef(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Runs an action, showing its error instead of throwing.
  const attempt = async (action) => {
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
  }

  const loadItems = useCallback(
    () =>
      client
        .listGroceries({ listId })
        .then(({ items }) => setItems(items))
        .catch((err) => setError(err.message)),
    [client, listId],
  )

  // Other members change shared lists too, so refresh when the tab regains focus.
  useEffect(() => {
    if (!list) return
    loadItems()
    const onFocus = () => document.visibilityState === 'visible' && loadItems()
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [list, loadItems])

  // Saves the order, reloading the list if that fails.
  const saveOrder = (ordered) =>
    attempt(async () => {
      try {
        await client.reorderGroceries({ listId, ids: ordered.map((item) => item.id) })
      } catch (err) {
        loadItems()
        throw err
      }
    })

  // While dragging (mouse or touch), the item moves past each row whose middle
  // the pointer crosses; dropping saves the new order. Listening on window
  // keeps the drag going when React moves the row in the DOM.
  useEffect(() => {
    if (!dragId) return
    const before = itemsRef.current.map((item) => item.id).join()
    const move = (event) => {
      const rows = [...listRef.current.children].filter((row) => row.dataset.id !== dragId)
      const index = rows.filter((row) => {
        const { top, height } = row.getBoundingClientRect()
        return top + height / 2 < event.clientY
      }).length
      setItems((current) => {
        const item = current.find((i) => i.id === dragId)
        if (current.indexOf(item) === index) return current
        const rest = current.filter((i) => i !== item)
        return [...rest.slice(0, index), item, ...rest.slice(index)]
      })
    }
    const drop = () => {
      setDragId(null)
      const ordered = itemsRef.current
      if (ordered.map((item) => item.id).join() !== before) saveOrder(ordered)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
    }
    // saveOrder only uses values that stay the same during a drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId])

  if (!lists && !listsError) return <p className="text-stone-500">Loading shopping list…</p>
  if (!list) {
    return (
      <div className="grid gap-3">
        <p>Shopping list not found.</p>
        <Link to="/groceries" className="btn justify-self-start">
          ← Back to shopping lists
        </Link>
      </div>
    )
  }

  const handleAdd = (event) => {
    event.preventDefault()
    if (!name.trim()) return
    attempt(async () => {
      const { items: added } = await client.addGroceries({
        listId,
        items: [{ name: name.trim(), quantity: quantity.trim() }],
      })
      setItems((current) => [...(current ?? []), ...added])
      setName('')
      setQuantity('')
    })
  }

  const toggle = (item) =>
    attempt(async () => {
      const { item: updated } = await client.updateGrocery({
        listId,
        id: item.id,
        changes: { done: !item.done },
      })
      setItems((current) => current.map((i) => (i.id === item.id ? updated : i)))
    })

  const remove = (item) =>
    attempt(async () => {
      await client.deleteGrocery({ listId, id: item.id })
      setItems((current) => current.filter((i) => i.id !== item.id))
    })

  const clearBought = () =>
    attempt(async () => {
      const bought = items.filter((item) => item.done)
      await Promise.all(bought.map((item) => client.deleteGrocery({ listId, id: item.id })))
      setItems((current) => current.filter((item) => !item.done))
    })

  // Arrow keys on a focused handle move its item one place.
  const handleKey = (event, item) => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key]
    const index = items.indexOf(item) + (step ?? 0)
    if (!step || index < 0 || index >= items.length) return
    event.preventDefault()
    const rest = items.filter((i) => i.id !== item.id)
    const ordered = [...rest.slice(0, index), item, ...rest.slice(index)]
    setItems(ordered)
    saveOrder(ordered)
  }

  const handleShare = (event) => {
    event.preventDefault()
    if (!shareEmail.trim()) return
    setSharing(true)
    attempt(async () => {
      const { list: shared } = await client.shareGroceryList({
        id: listId,
        email: shareEmail.trim(),
      })
      updateList(listId, shared)
      setShareEmail('')
    }).finally(() => setSharing(false))
  }

  // The owner removes a member; a member removing themselves leaves the list.
  const removeMember = (member) =>
    attempt(async () => {
      await client.unshareGroceryList({ id: listId, userId: member.id })
      if (list.mine) {
        updateList(listId, { ...list, members: list.members.filter((m) => m.id !== member.id) })
      } else {
        updateList(listId, null)
        navigate('/groceries')
      }
    })

  const deleteList = () => {
    if (!window.confirm(`Delete “${list.name}” and its items for everyone?`)) return
    attempt(async () => {
      await client.deleteGroceryList({ id: listId })
      updateList(listId, null)
      navigate('/groceries')
    })
  }

  const isMe = (member) => member.email.toLowerCase() === email?.toLowerCase()
  const me = list.members.find(isMe)
  const others = list.members.filter((m) => m.id !== list.ownerId)

  return (
    <div className="grid gap-4">
      <Link to="/groceries" className="text-sm text-orange-700 hover:underline dark:text-orange-300">
        ← All shopping lists
      </Link>

      <header>
        <h2 className="text-2xl font-bold">{list.name}</h2>
        <p className="text-sm text-stone-500">{sharingSummary(list)}</p>
      </header>

      {error && (
        <p className={errorClass} role="alert">
          {error}
        </p>
      )}

      <form className="flex flex-wrap gap-2" onSubmit={handleAdd}>
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

      {!items && <p className="text-stone-500">Loading items…</p>}
      {items?.length === 0 && <p className="text-stone-500">Nothing to buy.</p>}
      {items?.length > 0 && (
        <ul ref={listRef} className="card divide-y divide-stone-200 p-0 dark:divide-stone-700">
          {items.map((item) => (
            <li
              key={item.id}
              data-id={item.id}
              className={`flex items-center gap-2 py-2 pr-4 pl-1 ${
                item.id === dragId ? 'relative z-10 bg-orange-50 shadow-md dark:bg-stone-800' : ''
              }`}
            >
              <button
                type="button"
                className={`touch-none rounded px-2 text-lg text-stone-400 select-none hover:text-stone-600 ${
                  dragId ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                aria-label={`Move ${item.name} (arrow keys)`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  setDragId(item.id)
                }}
                onKeyDown={(e) => handleKey(e, item)}
              >
                ⠿
              </button>
              <label
                className={`flex flex-1 cursor-pointer items-center gap-3 ${
                  item.done ? 'text-stone-400 line-through' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-orange-600"
                  checked={item.done}
                  onChange={() => toggle(item)}
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
                onClick={() => remove(item)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {items?.some((item) => item.done) && (
        <button type="button" className="btn justify-self-start" onClick={clearBought}>
          Clear bought items
        </button>
      )}

      <section className="card grid gap-3">
        <h3 className="font-semibold">Sharing</h3>
        {others.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {others.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2">
                <span>
                  {member.email}
                  {isMe(member) && <span className="text-stone-500"> (you)</span>}
                </span>
                {list.mine && (
                  <button
                    type="button"
                    className="rounded px-2 text-stone-400 hover:text-red-600"
                    aria-label={`Stop sharing with ${member.email}`}
                    onClick={() => removeMember(member)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {list.mine ? (
          <>
            <form className="flex flex-wrap gap-2" onSubmit={handleShare}>
              <input
                className="input flex-[2_1_12rem]"
                type="email"
                aria-label="Share with email"
                placeholder="Share with (email)"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
              <button type="submit" className="btn" disabled={sharing}>
                {sharing ? 'Sharing…' : 'Share'}
              </button>
            </form>
            <button type="button" className="btn justify-self-start" onClick={deleteList}>
              Delete list
            </button>
          </>
        ) : (
          me && (
            <button
              type="button"
              className="btn justify-self-start"
              onClick={() => removeMember(me)}
            >
              Leave list
            </button>
          )
        )}
      </section>
    </div>
  )
}
