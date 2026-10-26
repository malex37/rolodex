import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <Link to="/recipes" className="btn justify-self-start">
        ← Back to recipes
      </Link>
    </div>
  )
}
