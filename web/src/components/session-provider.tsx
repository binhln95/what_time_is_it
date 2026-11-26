import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { AUTH_CHANGED, getSession, handleRedirect } from "@/lib/auth"
import { errorMessage } from "@/lib/api"
import { SessionContext } from "@/hooks/use-session"

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(getSession)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    handleRedirect()
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => {
        setSession(getSession())
        setReady(true)
      })

    const onChange = () => setSession(getSession())
    window.addEventListener(AUTH_CHANGED, onChange)
    return () => window.removeEventListener(AUTH_CHANGED, onChange)
  }, [])

  return (
    <SessionContext.Provider value={{ session, ready }}>
      {children}
    </SessionContext.Provider>
  )
}
