import { useEffect, useRef, useState } from 'react'

// A modal asking to pick one of `choices` ([{ value, label }]). Calls
// onChoose(value) for a pick; onClose once it closes, picked or not
// (Cancel, Escape or a tap outside). With `create` ({ label, placeholder,
// onCreate(name) }), it also offers to name a new choice instead.
export default function ChoiceDialog({ title, choices, onChoose, onClose, create }) {
  const ref = useRef(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    ref.current.showModal()
  }, [])

  const close = () => ref.current.close()

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-lg bg-white text-stone-800 shadow-xl backdrop:bg-black/40 dark:bg-stone-800 dark:text-stone-200"
      onClose={onClose}
      // A tap on the backdrop lands on the dialog itself, outside its content.
      onClick={(event) => event.target === ref.current && close()}
    >
      <div className="grid gap-3 p-4">
        <h3 className="font-semibold">{title}</h3>
        <ul className="grid gap-1">
          {choices.map((choice) => (
            <li key={choice.value ?? ''}>
              <button
                type="button"
                className="w-full rounded-md border border-stone-200 px-3 py-2 text-left hover:border-orange-400 hover:bg-orange-50 dark:border-stone-700 dark:hover:bg-orange-950/40"
                onClick={() => {
                  onChoose(choice.value)
                  close()
                }}
              >
                {choice.label}
              </button>
            </li>
          ))}
          {create && !creating && (
            <li>
              <button
                type="button"
                className="w-full rounded-md border border-dashed border-stone-300 px-3 py-2 text-left text-stone-600 hover:border-orange-400 hover:text-orange-700 dark:border-stone-600 dark:text-stone-300 dark:hover:text-orange-300"
                onClick={() => setCreating(true)}
              >
                {create.label}
              </button>
            </li>
          )}
        </ul>
        {creating && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!name.trim()) return
              create.onCreate(name.trim())
              close()
            }}
          >
            <input
              className="input flex-[1_1_10rem]"
              aria-label={create.label}
              placeholder={create.placeholder}
              maxLength={60}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Create and move
            </button>
          </form>
        )}
        <button type="button" className="btn justify-self-end" onClick={close}>
          Cancel
        </button>
      </div>
    </dialog>
  )
}
