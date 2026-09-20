import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { APP_HOME_PATH, resolveAppHomePath } from "@/lib/appHome"
import { useProjectsStore } from "@/store/projectsStore"
import Dashboard from "@/pages/Dashboard"

function HomeLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--surface))]">
      <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
    </div>
  )
}

/**
 * Post-login / leftover `/projects` entry: land on last-opened (or most recent)
 * workbench, or the empty workspace. Never the project-card gallery.
 */
export default function AppHomeRedirect() {
  const location = useLocation()
  const { projects, isLoaded, fetchProjects } = useProjectsStore()
  const [hydrated, setHydrated] = useState(() => useProjectsStore.persist.hasHydrated())

  useEffect(() => {
    const unsub = useProjectsStore.persist.onFinishHydration(() => setHydrated(true))
    if (useProjectsStore.persist.hasHydrated()) {
      setHydrated(true)
    }
    return unsub
  }, [])

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  if (!hydrated) {
    return <HomeLoading />
  }

  const hasCachedProjects = projects.length > 0
  if (!isLoaded && !hasCachedProjects) {
    return <HomeLoading />
  }

  const target = resolveAppHomePath(projects)
  if (target !== APP_HOME_PATH) {
    return <Navigate to={target} replace />
  }

  if (location.pathname !== APP_HOME_PATH) {
    return <Navigate to={APP_HOME_PATH} replace />
  }

  return <Dashboard />
}
