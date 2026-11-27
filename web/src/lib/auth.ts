// Login / sign-up against the Cognito user pool, from our own forms (no Hosted UI redirect).
// aws-amplify/auth talks to Cognito directly: SRP for passwords (the password itself is never
// sent), and it stores + refreshes the tokens. The ID token is sent to the API as Bearer token.

import { Amplify } from "aws-amplify"
import {
  autoSignIn,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth"
import { config } from "@/lib/config"

export const AUTH_CHANGED = "auth-changed"

export interface Session {
  token: string
  email: string
}

let configured = false
function ensureConfigured() {
  if (!config) throw new Error("Missing config.js - run `npm run web:config`")
  if (!configured) {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: config.userPoolId,
          userPoolClientId: config.userPoolClientId,
          loginWith: { email: true },
          signUpVerificationMethod: "code",
        },
      },
    })
    configured = true
  }
}

const notifyChanged = () => window.dispatchEvent(new Event(AUTH_CHANGED))

// Current session, or null when logged out. Expired ID tokens are refreshed automatically.
export async function getSession(): Promise<Session | null> {
  if (!config) return null
  ensureConfigured()
  try {
    const { tokens } = await fetchAuthSession()
    const idToken = tokens?.idToken
    if (!idToken) return null
    return {
      token: idToken.toString(),
      email: String(idToken.payload.email ?? ""),
    }
  } catch {
    return null
  }
}

// "confirm-sign-up": the account exists but its email is not verified yet (a new code was sent).
export type LogInResult = "done" | "confirm-sign-up"

export async function logIn(
  email: string,
  password: string
): Promise<LogInResult> {
  ensureConfigured()
  try {
    const { nextStep } = await signIn({ username: email, password })
    if (nextStep.signInStep === "DONE") {
      notifyChanged()
      return "done"
    }
    if (nextStep.signInStep === "CONFIRM_SIGN_UP") {
      await resendSignUpCode({ username: email })
      return "confirm-sign-up"
    }
    throw new Error(`Unsupported sign-in step: ${nextStep.signInStep}`)
  } catch (err) {
    if ((err as Error).name === "UserAlreadyAuthenticatedException") {
      notifyChanged()
      return "done"
    }
    throw err
  }
}

// Creates the account; Cognito emails a 6-digit code to confirm it.
export async function register(email: string, password: string) {
  ensureConfigured()
  await signUp({
    username: email,
    password,
    options: { userAttributes: { email }, autoSignIn: true },
  })
}

// Confirms the email with the code and logs in. Returns false when the account is confirmed
// but could not be logged in automatically (the user then logs in with the form).
export async function confirmRegistration(
  email: string,
  code: string,
  password?: string
): Promise<boolean> {
  ensureConfigured()
  const { nextStep } = await confirmSignUp({
    username: email,
    confirmationCode: code,
  })
  if (nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
    const { nextStep: signInStep } = await autoSignIn()
    if (signInStep.signInStep === "DONE") {
      notifyChanged()
      return true
    }
  }
  // Came from the login form (no auto sign-in pending): log in with the password we have.
  if (password) return (await logIn(email, password)) === "done"
  return false
}

export async function resendCode(email: string) {
  ensureConfigured()
  await resendSignUpCode({ username: email })
}

export async function logOut() {
  ensureConfigured()
  await signOut()
  notifyChanged()
}

// Called when the API rejects the token (401).
export function clearSession() {
  if (!config) return
  ensureConfigured()
  signOut()
    .catch(() => {})
    .finally(notifyChanged)
}
