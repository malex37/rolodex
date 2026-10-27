import { useEffect, useLayoutEffect, useRef } from 'react'

// A menu of actions opened at a point (a right-click or long press), kept
// inside the window. items: [{ label, onSelect, danger?, disabled? }].
// Closes on selection, outside press, Escape, scrolling or resizing.
export default function ContextMenu({ x, y, label, items, onClose }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const menu = ref.current
    const { width, height } = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`
    menu.querySelector('button:not(:disabled)')?.focus()
  }, [x, y])

  useEffect(() => {
    const onPointerDown = (event) => !ref.current?.contains(event.target) && onClose()
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return (
    <ul
      ref={ref}
      role="menu"
      aria-label={label}
      className="fixed z-50 min-w-44 rounded-md border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-800"
    >
      {items.map((item) => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`block w-full px-3 py-2 text-left text-sm hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-stone-700 ${
              item.danger ? 'text-red-600 dark:text-red-400' : ''
            }`}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
