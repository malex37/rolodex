import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import ChoiceDialog from '../components/ChoiceDialog.jsx'
import ContextMenu from '../components/ContextMenu.jsx'
import { sharingSummary } from '../groceryLists.js'
import { useLongPress } from '../hooks/useLongPress.js'

// How long a bought item takes to swipe off; matches duration-300 below.
const SWIPE_MS = 300

const errorClass = 'text-sm text-red-600 dark:text-red-400'

// Adds one item; `compact` is the smaller form at the foot of a section.
function AddItemForm({ onAdd, compact = false }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    if (await onAdd(name.trim(), quantity.trim())) {
      setName('')
      setQuantity('')
    }
  }

  return (
    <form className={`flex flex-wrap gap-2 ${compact ? 'px-3 py-2' : ''}`} onSubmit={handleSubmit}>
      <input
        className="input flex-[2_1_10rem]"
        aria-label="Item"
        placeholder={compact ? 'Add an item' : 'Item'}
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
      <button type="submit" className={compact ? 'btn' : 'btn btn-primary'}>
        Add
      </button>
    </form>
  )
}

// A plus sign, drawn in the text color.
function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// The items with one moved into a section (null: the main one), at `index`
// among its items. Items keep one order across the whole list; each section
// shows its own in that order. sectionOf(item) says which section it's in.
function withItemAt(items, id, sectionId, index, sectionOf) {
  const item = items.find((i) => i.id === id)
  const rest = items.filter((i) => i !== item)
  const inSection = rest.filter((i) => sectionOf(i) === sectionId)
  const at =
    index < inSection.length
      ? rest.indexOf(inSection[index])
      : inSection.length > 0
        ? rest.indexOf(inSection.at(-1)) + 1
        : rest.length
  if (items.indexOf(item) === at && sectionOf(item) === sectionId) return items
  const { sectionId: _old, ...moved } = item
  return [...rest.slice(0, at), sectionId ? { ...moved, sectionId } : moved, ...rest.slice(at)]
}

// A section's name, edited in place and saved when it loses focus (Enter too).
function SectionName({ section, autoFocus, onSave }) {
  const [name, setName] = useState(section.name)
  return (
    <input
      className="min-w-0 flex-1 bg-transparent py-1 font-semibold placeholder:font-normal placeholder:text-stone-400 focus:outline-none"
      aria-label="Section name"
      placeholder="Section name, e.g. a store"
      maxLength={60}
      value={name}
      autoFocus={autoFocus}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onBlur={() => onSave(name.trim())}
    />
  )
}

// Of the item lists on the page, the one at height y, or else the nearest.
function listAt(lists, y) {
  const distance = (list) => {
    const { top, bottom } = list.getBoundingClientRect()
    return y < top ? top - y : y > bottom ? y - bottom : 0
  }
  return lists.reduce((best, list) => (distance(list) < distance(best) ? list : best))
}

export default function ShoppingList() {
  const { listId } = useParams()
  const { client, email } = useAuth()
  const { lists, listsError, reloadLists, updateList } = useOutletContext()
  const navigate = useNavigate()
  const list = lists?.find((l) => l.id === listId)

  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [sharing, setSharing] = useState(false)
  // The item being dragged by its handle: where its ghost is drawn (fixed
  // position), and where on the row it was grabbed.
  const [drag, setDrag] = useState(null)
  const dragId = drag?.id
  // A bought item swipes off to the right, then reappears at the end.
  const [swipingId, setSwipingId] = useState(null)
  const [arrivedId, setArrivedId] = useState(null)
  // Sections group the list's items, e.g. by store. An item whose section is
  // gone (removed by another member meanwhile) shows in the main section.
  const sections = list?.sections ?? []
  const sectionOf = (item) =>
    sections.some((section) => section.id === item.sectionId) ? item.sectionId : null
  const sectionOfRef = useRef(sectionOf)
  sectionOfRef.current = sectionOf
  // The section just added, whose name field gets the focus.
  const [newSectionId, setNewSectionId] = useState(null)
  // An item's actions, opened by a right-click or long press at { x, y };
  // and the item being moved to another section.
  const [menu, setMenu] = useState(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const [moving, setMoving] = useState(null)
  const press = useLongPress(({ clientX, clientY }, item) => {
    if (!dragId) setMenu({ x: clientX, y: clientY, item })
  })
  const groupsRef = useRef(null)
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

  // Other members change shared lists (items and sections) too, so refresh
  // when the tab regains focus.
  const hasList = Boolean(list)
  useEffect(() => {
    if (!hasList) return
    loadItems()
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return
      loadItems()
      reloadLists()
    }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [hasList, loadItems, reloadLists])

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

  // Saves which section an item is in, reloading the list if that fails.
  const saveSection = (item, sectionId) =>
    attempt(async () => {
      try {
        await client.updateGrocery({ listId, id: item.id, changes: { sectionId } })
      } catch (err) {
        loadItems()
        throw err
      }
    })

  // Puts an item at `index` among the items of a section.
  const placeItem = (id, sectionId, index) =>
    setItems((current) => withItemAt(current, id, sectionId, index, sectionOfRef.current))

  // While dragging (mouse or touch), a ghost of the item follows the pointer
  // and an empty slot opens where it would land: in the section under the
  // ghost, past each row whose middle the ghost's middle crosses. Dropping
  // saves the new order and section. Listening on window keeps the drag
  // going when React moves the slot.
  useEffect(() => {
    if (!dragId) return
    const before = itemsRef.current.map((item) => item.id).join()
    const findDragged = () => itemsRef.current.find((item) => item.id === dragId)
    const sectionBefore = sectionOfRef.current(findDragged())
    const { grabY, height } = drag
    const move = (event) => {
      const top = event.clientY - grabY
      const middle = top + height / 2
      setDrag((current) => ({ ...current, top }))
      const list = listAt([...groupsRef.current.querySelectorAll('ul[data-section]')], middle)
      const rows = [...list.querySelectorAll(':scope > li[data-id]')].filter(
        (row) => row.dataset.id !== dragId,
      )
      const index = rows.filter((row) => {
        const rect = row.getBoundingClientRect()
        return rect.top + rect.height / 2 < middle
      }).length
      placeItem(dragId, list.dataset.section || null, index)
    }
    const drop = () => {
      setDrag(null)
      const ordered = itemsRef.current
      const sectionId = sectionOfRef.current(findDragged())
      if (sectionId !== sectionBefore) saveSection(findDragged(), sectionId)
      if (ordered.map((item) => item.id).join() !== before) saveOrder(ordered)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    document.body.style.cursor = 'grabbing'
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
    }
    // drag (its grab point and size), placeItem, saveSection and saveOrder
    // stay the same during a drag.
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

  // Adds an item to a section (null: the main one); true once added.
  const addItem = async (sectionId, name, quantity) => {
    let added = false
    await attempt(async () => {
      const { items: created } = await client.addGroceries({
        listId,
        items: [{ name, quantity, ...(sectionId && { sectionId }) }],
      })
      setItems((current) => [...(current ?? []), ...created])
      added = true
    })
    return added
  }

  const addSection = () =>
    attempt(async () => {
      const { list: updated } = await client.createGrocerySection({ listId, name: '' })
      updateList(listId, updated)
      setNewSectionId(updated.sections.at(-1)?.id)
    })

  const renameSection = (section, name) => {
    setNewSectionId(null)
    if (name === section.name) return
    attempt(async () => {
      const { list: updated } = await client.renameGrocerySection({ listId, id: section.id, name })
      updateList(listId, updated)
    })
  }

  // Its items go back to the main section.
  const deleteSection = (section) => {
    const count = items?.filter((item) => sectionOf(item) === section.id).length
    const label = section.name || 'this section'
    if (count && !window.confirm(`Remove ${label}? Its ${count} item(s) move to the main list.`)) {
      return
    }
    attempt(async () => {
      const { list: updated } = await client.deleteGrocerySection({ listId, id: section.id })
      updateList(listId, updated)
      setItems((current) =>
        current.map(({ sectionId, ...item }) =>
          sectionId === section.id ? item : { ...item, sectionId },
        ),
      )
    })
  }

  const toggle = (item) => {
    if (!item.done) return markBought(item)
    return attempt(async () => {
      const { item: updated } = await client.updateGrocery({
        listId,
        id: item.id,
        changes: { done: false },
      })
      setItems((current) => current.map((i) => (i.id === item.id ? updated : i)))
    })
  }

  // Checks the item off at once and swipes it away; once saved and swiped, it
  // moves to the end of the list and that order is saved too.
  const markBought = (item) => {
    if (swipingId) return
    const replace = (changed) =>
      setItems((current) => current.map((i) => (i.id === item.id ? changed : i)))
    replace({ ...item, done: true })
    setSwipingId(item.id)
    const swipe = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : SWIPE_MS
    return attempt(async () => {
      try {
        const [{ item: updated }] = await Promise.all([
          client.updateGrocery({ listId, id: item.id, changes: { done: true } }),
          new Promise((resolve) => setTimeout(resolve, swipe)),
        ])
        const ordered = [...itemsRef.current.filter((i) => i.id !== item.id), updated]
        setItems(ordered)
        setArrivedId(item.id)
        saveOrder(ordered)
      } catch (err) {
        replace(item)
        throw err
      } finally {
        setSwipingId(null)
      }
    })
  }

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

  // Moves an item to the end of another section. Reads the latest items, as
  // it can follow a section being created.
  const moveToSection = (item, sectionId) => {
    const current = itemsRef.current
    const ordered = withItemAt(current, item.id, sectionId, Infinity, sectionOf)
    setItems(ordered)
    setArrivedId(item.id)
    saveSection(item, sectionId)
    if (ordered.map((i) => i.id).join() !== current.map((i) => i.id).join()) saveOrder(ordered)
  }

  // Creates a section and moves the item to it.
  const moveToNewSection = (item, name) =>
    attempt(async () => {
      const { list: updated } = await client.createGrocerySection({ listId, name })
      updateList(listId, updated)
      // The new one, even if another member added a section meanwhile.
      const created = updated.sections.findLast(
        (section) => section.name === name && !sections.some((s) => s.id === section.id),
      )
      if (created) moveToSection(item, created.id)
    })

  const sectionLabel = (sectionId) =>
    sectionId
      ? sections.find((s) => s.id === sectionId)?.name || 'Untitled section'
      : 'Main list'

  // Arrow keys on a focused handle move its item one place within its section.
  const handleKey = (event, item) => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key]
    const inSection = items.filter((i) => sectionOf(i) === sectionOf(item))
    const neighbor = inSection[inSection.indexOf(item) + (step ?? 0)]
    if (!step || !neighbor) return
    event.preventDefault()
    const rest = items.filter((i) => i.id !== item.id)
    const at = rest.indexOf(neighbor) + (step > 0 ? 1 : 0)
    const ordered = [...rest.slice(0, at), item, ...rest.slice(at)]
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

  // Starts dragging the item whose handle was pressed, with its ghost drawn
  // exactly over its row.
  const startDrag = (event, item) => {
    if (event.button !== 0) return
    event.preventDefault()
    const { top, left, width, height } = event.currentTarget.closest('li').getBoundingClientRect()
    setDrag({ id: item.id, top, left, width, height, grabY: event.clientY - top })
  }

  const rowContent = (item) => (
    <>
      <button
        type="button"
        className={`touch-none rounded px-2 text-lg text-stone-400 select-none hover:text-stone-600 ${
          drag ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        aria-label={`Move ${item.name} (arrow keys)`}
        data-no-long-press
        onPointerDown={(e) => startDrag(e, item)}
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
    </>
  )
  const rowClass = 'flex items-center gap-2 py-2 pr-4 pl-1'
  const dragged = drag && items.find((item) => item.id === drag.id)
  const itemsIn = (sectionId) => items.filter((item) => sectionOf(item) === sectionId)

  // One section's items (null: the main section's).
  const itemList = (sectionId) => {
    const sectionItems = itemsIn(sectionId)
    return (
      <ul
        data-section={sectionId ?? ''}
        className="divide-y divide-stone-200 overflow-hidden dark:divide-stone-700"
      >
        {sectionItems.map((item) =>
          item.id === dragId ? (
            // The empty slot the dragged item would land in.
            <li
              key={item.id}
              data-id={item.id}
              aria-hidden
              className="bg-stone-100 dark:bg-stone-900"
              style={{ height: drag.height }}
            />
          ) : (
            <li
              key={item.id}
              data-id={item.id}
              {...press(item)}
              className={`${rowClass} select-none [-webkit-touch-callout:none] ${
                item.id === swipingId
                  ? 'translate-x-full opacity-0 motion-safe:transition motion-safe:duration-300'
                  : ''
              } ${item.id === arrivedId ? 'motion-safe:animate-[fade-in_300ms_ease-out]' : ''}`}
              onAnimationEnd={() => setArrivedId(null)}
            >
              {rowContent(item)}
            </li>
          ),
        )}
        {sectionItems.length === 0 && (
          <li className="px-4 py-3 text-sm text-stone-500">
            {sectionId ? 'Drag items here, or add one below.' : 'Drag items here to keep them up top.'}
          </li>
        )}
      </ul>
    )
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

      <AddItemForm onAdd={(name, quantity) => addItem(null, name, quantity)} />

      {!items && <p className="text-stone-500">Loading items…</p>}
      {items?.length === 0 && sections.length === 0 && (
        <p className="text-stone-500">Nothing to buy.</p>
      )}
      {items && (items.length > 0 || sections.length > 0) && (
        <div ref={groupsRef} className="grid gap-4">
          <div className="card p-0">{itemList(null)}</div>

          {sections.map((section) => (
            <section
              key={section.id}
              className="card overflow-hidden border-orange-200 p-0 dark:border-orange-900"
            >
              <header className="flex items-center gap-2 border-b border-orange-200 bg-orange-50 py-1 pr-2 pl-4 dark:border-orange-900 dark:bg-orange-950/40">
                <SectionName
                  // Starts over when the saved name changes, e.g. on a reload.
                  key={section.name}
                  section={section}
                  autoFocus={section.id === newSectionId}
                  onSave={(name) => renameSection(section, name)}
                />
                <button
                  type="button"
                  className="rounded px-2 text-lg text-stone-400 hover:text-red-600"
                  aria-label={`Remove section ${section.name}`}
                  onClick={() => deleteSection(section)}
                >
                  ×
                </button>
              </header>
              {itemList(section.id)}
              <div className="border-t border-stone-200 dark:border-stone-700">
                <AddItemForm
                  compact
                  onAdd={(name, quantity) => addItem(section.id, name, quantity)}
                />
              </div>
            </section>
          ))}
        </div>
      )}
      {dragged && (
        <div
          inert
          className={`card pointer-events-none fixed z-50 shadow-xl ring-2 ring-orange-400/60 ${rowClass}`}
          style={{ top: drag.top, left: drag.left, width: drag.width }}
        >
          {rowContent(dragged)}
        </div>
      )}

      {items && (
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 px-4 py-3 text-sm font-medium text-stone-500 hover:border-orange-400 hover:text-orange-700 dark:border-stone-600 dark:hover:text-orange-300"
          onClick={addSection}
        >
          Add a section <PlusIcon />
        </button>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label={`${menu.item.name} actions`}
          onClose={closeMenu}
          items={[
            { label: 'Remove', danger: true, onSelect: () => remove(menu.item) },
            {
              label: 'Move to section…',
              onSelect: () => setMoving(menu.item),
            },
          ]}
        />
      )}
      {moving && (
        <ChoiceDialog
          title={`Move ${moving.name} to`}
          choices={[null, ...sections.map((s) => s.id)]
            .filter((sectionId) => sectionId !== sectionOf(moving))
            .map((sectionId) => ({ value: sectionId, label: sectionLabel(sectionId) }))}
          onChoose={(sectionId) => moveToSection(moving, sectionId)}
          create={{
            label: 'New section…',
            placeholder: 'Section name, e.g. a store',
            onCreate: (name) => moveToNewSection(moving, name),
          }}
          onClose={() => setMoving(null)}
        />
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
