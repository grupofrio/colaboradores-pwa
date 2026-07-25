import { Link } from 'react-router-dom'

export default function SupervisorQuickActions({ actions }) {
  if (!actions.length) return null

  return (
    <nav
      className="supervisor-ops-card"
      data-testid="supervisor-quick-actions"
      aria-labelledby="supervisor-quick-actions-title"
    >
      <h2 id="supervisor-quick-actions-title">Acciones rápidas</h2>
      <div className="supervisor-ops-quick-actions">
        {actions.map((action) => (
          <Link key={action.href} to={action.href}>{action.label}</Link>
        ))}
      </div>
    </nav>
  )
}
