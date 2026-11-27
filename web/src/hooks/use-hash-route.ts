import { useEffect, useState } from "react"

// Tiny hash router: "#/login", "#/signup", ... (no router library needed).
export function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])

  return hash
}

// Navigate to a hash route; navigate("") goes back to the main page with a clean URL.
export function navigate(hash: string) {
  if (hash) {
    window.location.hash = hash
  } else {
    window.history.pushState(null, "", window.location.pathname)
    window.dispatchEvent(new HashChangeEvent("hashchange"))
  }
}
