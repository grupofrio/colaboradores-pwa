import { Outlet } from 'react-router-dom'
import { getAdminThemeScopeStyle } from '../adminTheme'

export default function AdminThemeScope() {
  return (
    <div id="admin-theme-scope" style={getAdminThemeScopeStyle()}>
      <Outlet />
    </div>
  )
}
