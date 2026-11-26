import { createFileRoute } from '@tanstack/react-router'
import { MasterAdminDashboard } from './admin'

function AdminContentRouteComponent() {
  return <MasterAdminDashboard initialSection="content" />
}

export const Route = createFileRoute('/admin_/content')({
  component: AdminContentRouteComponent,
})
