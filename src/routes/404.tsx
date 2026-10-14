import { createFileRoute } from "@tanstack/react-router"
import { NotFoundPage } from "~/components/eggs/NotFound"

// prerendered to /404.html (vite.config.ts); unknown URLs render the same
// component through the root route's notFoundComponent
export const Route = createFileRoute("/404")({ component: NotFoundPage })
