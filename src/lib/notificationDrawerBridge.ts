export type NotificationDrawerTab = "messages" | "history"

export type NotificationDrawerRequest = {
  tab: NotificationDrawerTab
  focusId?: string | null
}

type Listener = (request: NotificationDrawerRequest) => void

const listeners = new Set<Listener>()

export function requestNotificationDrawer(request: NotificationDrawerRequest) {
  listeners.forEach((listener) => listener(request))
}

export function subscribeNotificationDrawer(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
