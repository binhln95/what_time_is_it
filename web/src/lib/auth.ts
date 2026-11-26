// Cognito Hosted UI login: OAuth2 authorization code flow + PKCE (no client secret).
// The ID token is kept in sessionStorage and sent to the API as a Bearer token.

import { config } from "@/lib/config"

const TOKEN_KEY = "idToken"
const PKCE_KEY = "pkce"
export const AUTH_CHANGED = "auth-changed"

export interface Session {
  token: string
  email: string
}

const redirectUri = () => `${window.location.origin}/`

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const randomString = (n: number) =>
  b64url(crypto.getRandomValues(new Uint8Array(n)))

function requireConfig() {
  if (!config) throw new Error("Missing config.js - run `npm run web:config`")
  return config
}

export async function login() {
  const cfg = requireConfig()
  const verifier = randomString(32)
  const state = randomString(16)
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }))
  const challenge = b64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  )
  const query = new URLSearchParams({
    response_type: "code",
    client_id: cfg.userPoolClientId,
    redirect_uri: redirectUri(),
    scope: "openid email",
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  })
  window.location.assign(`${cfg.cognitoDomain}/oauth2/authorize?${query}`)
}

// After login Cognito redirects back with ?code=...&state=...; exchange the code for tokens.
export async function handleRedirect() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get("code")
  if (!code) return
  window.history.replaceState(null, "", redirectUri())

  const saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? "null") as {
    verifier: string
    state: string
  } | null
  sessionStorage.removeItem(PKCE_KEY)
  if (!saved || saved.state !== params.get("state"))
    throw new Error("Login state mismatch, please try again")

  const cfg = requireConfig()
  const res = await fetch(`${cfg.cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cfg.userPoolClientId,
      code,
      redirect_uri: redirectUri(),
      code_verifier: saved.verifier,
    }),
  })
  if (!res.ok) throw new Error(`Login failed (${res.status})`)
  const tokens = (await res.json()) as { id_token: string }
  sessionStorage.setItem(TOKEN_KEY, tokens.id_token) // the ID token carries the email claim
}

export function getSession(): Session | null {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token) return null
  try {
    const claims = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    )
    if (claims.exp * 1000 < Date.now()) throw new Error("expired")
    return { token, email: String(claims.email ?? "") }
  } catch {
    sessionStorage.removeItem(TOKEN_KEY)
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  window.dispatchEvent(new Event(AUTH_CHANGED))
}

export function logout() {
  const cfg = requireConfig()
  sessionStorage.removeItem(TOKEN_KEY)
  const query = new URLSearchParams({
    client_id: cfg.userPoolClientId,
    logout_uri: redirectUri(),
  })
  window.location.assign(`${cfg.cognitoDomain}/logout?${query}`)
}
