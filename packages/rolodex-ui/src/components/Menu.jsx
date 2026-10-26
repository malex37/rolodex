import { useEffect, useId, useRef, useState } from 'react'

// A "⋯" button that opens a dropdown of actions. items: [{ label, onSelect, danger? }].
// Closes on selection, outside click or Escape.
export default function Menu({ label, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => !ref.current?.contains(event.target) && setOpen(false)
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn px-2"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-32 rounded-md border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-800"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-700 ${
                  item.danger ? 'text-red-600 dark:text-red-400' : ''
                }`}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
