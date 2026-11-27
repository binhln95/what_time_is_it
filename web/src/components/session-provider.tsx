import { useEffect, useState, type ReactNode } from "react"
import { AUTH_CHANGED, getSession, type Session } from "@/lib/auth"
import { SessionContext } from "@/hooks/use-session"

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getSession().then((s) => {
        if (cancelled) return
        setSession(s)
        setReady(true)
      })

    load()
    window.addEventListener(AUTH_CHANGED, load)
    return () => {
      cancelled = true
      window.removeEventListener(AUTH_CHANGED, load)
    }
  }, [])

  return (
    <SessionContext.Provider value={{ session, ready }}>
      {children}
    </SessionContext.Provider>
  )
}
