import { useRef } from 'react'

// How long a touch must be held, and how far it may wander (px) meanwhile.
const HOLD_MS = 500
const SLOP_PX = 10

// Calls onLongPress({ clientX, clientY }, payload) on a right-click, or when a
// touch or pen is held still on the element. Spread `press(payload)` onto the
// element; children marked data-no-long-press (a drag handle) don't start one.
export function useLongPress(onLongPress) {
  const pending = useRef(null)
  const fired = useRef(false)

  const cancel = () => {
    clearTimeout(pending.current?.timer)
    pending.current = null
  }

  return (payload) => ({
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' || event.target.closest('[data-no-long-press]')) return
      cancel()
      fired.current = false
      const { clientX, clientY } = event
      pending.current = {
        clientX,
        clientY,
        timer: setTimeout(() => {
          pending.current = null
          fired.current = true
          onLongPress({ clientX, clientY }, payload)
        }, HOLD_MS),
      }
    },
    onPointerMove: (event) => {
      const start = pending.current
      if (start && Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > SLOP_PX) {
        cancel()
      }
    },
    onPointerUp: cancel,
    // Also when the browser takes the touch over to scroll.
    onPointerCancel: cancel,
    // The tap that ends a long press shouldn't also check the item off.
    onClickCapture: (event) => {
      if (!fired.current) return
      fired.current = false
      event.preventDefault()
      event.stopPropagation()
    },
    // A right-click, or the browser's own long press (Android).
    onContextMenu: (event) => {
      event.preventDefault()
      cancel()
      onLongPress(event, payload)
    },
  })
}
