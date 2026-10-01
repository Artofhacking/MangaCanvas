import { describe, expect, it } from "vitest"
import { requestNotificationDrawer, subscribeNotificationDrawer } from "./notificationDrawerBridge"

describe("notificationDrawerBridge", () => {
  it("delivers history requests only to active subscribers", () => {
    const seen: string[] = []
    const unsubscribe = subscribeNotificationDrawer((request) => {
      seen.push(`${request.tab}:${request.focusId || ""}`)
    })
    requestNotificationDrawer({ tab: "history", focusId: "gen_1" })
    unsubscribe()
    requestNotificationDrawer({ tab: "messages" })
    expect(seen).toEqual(["history:gen_1"])
  })
})
