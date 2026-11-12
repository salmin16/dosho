import { createFileRoute } from '@tanstack/react-router'
import { MasterAdminDashboard } from './admin'

export const Route = createFileRoute('/admin_/content')({
  component: () => <MasterAdminDashboard initialSection="content" />,
})
