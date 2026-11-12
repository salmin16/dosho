import { createFileRoute } from '@tanstack/react-router'
import { MasterAdminDashboard } from './admin'

export const Route = createFileRoute('/admin_/users')({
  component: () => <MasterAdminDashboard initialSection="users" />,
})
