import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/briscaedu')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/briscaedu"!</div>
}
