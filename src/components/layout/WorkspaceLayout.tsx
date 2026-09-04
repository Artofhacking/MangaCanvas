import { ReactNode, useEffect } from "react"
import Sidebar from "@/components/layout/Sidebar"

interface WorkspaceLayoutProps {
  header: ReactNode
  children: ReactNode
}

export default function WorkspaceLayout({ header, children }: WorkspaceLayoutProps) {
  useEffect(() => {
    document.body.classList.add("workspace-body-lock")

    return () => {
      document.body.classList.remove("workspace-body-lock")
    }
  }, [])

  return (
    <div className="workspace-shell h-dvh w-full overflow-hidden bg-[hsl(var(--surface))]">
      <Sidebar />
      <div className="ml-64 flex h-full min-w-0 flex-col">
        {header}
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-8 pb-12 pt-24">
          {children}
        </main>
      </div>
    </div>
  )
}
