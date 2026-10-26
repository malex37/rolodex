// Marks a recipe only its owner can see.
export default function PrivateBadge() {
  return (
    <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 align-middle text-xs font-medium text-stone-700 dark:bg-stone-700 dark:text-stone-200">
      Private
    </span>
  )
}
