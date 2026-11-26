import { createContext, useContext } from "react"
import type { Session } from "@/lib/auth"

export interface SessionState {
  session: Session | null
  ready: boolean // false while the login redirect is being processed
}

export const SessionContext = createContext<SessionState | undefined>(undefined)

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used within a SessionProvider")
  return ctx
}
