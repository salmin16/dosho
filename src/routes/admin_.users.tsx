import { createFileRoute } from '@tanstack/react-router'
import { MasterAdminDashboard } from './admin'

function AdminUsersRouteComponent() {
  return <MasterAdminDashboard initialSection="users" />
}

export const Route = createFileRoute('/admin_/users')({
  component: AdminUsersRouteComponent,
})
