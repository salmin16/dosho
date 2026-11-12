import { createFileRoute } from '@tanstack/react-router'
import { MasterAdminDashboard } from './admin'

export const Route = createFileRoute('/admin_/approvals')({
  component: () => <MasterAdminDashboard initialSection="approvals" />,
})
