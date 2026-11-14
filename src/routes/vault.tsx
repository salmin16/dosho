import { createFileRoute } from '@tanstack/react-router'
import { DashboardRouteComponent } from './dashboard'

export const Route = createFileRoute('/vault')({
  component: DashboardRouteComponent,
})
