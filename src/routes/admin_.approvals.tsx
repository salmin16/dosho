import { createFileRoute } from '@tanstack/react-router'
import { MasterAdminDashboard } from './admin'

function AdminApprovalsRouteComponent() {
  return <MasterAdminDashboard initialSection="approvals" />
}

export const Route = createFileRoute('/admin_/approvals')({
  component: AdminApprovalsRouteComponent,
})
