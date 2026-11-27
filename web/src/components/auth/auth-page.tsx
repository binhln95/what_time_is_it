import { useState } from "react"
import { ClockIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { ConfirmForm } from "@/components/auth/confirm-form"
import { LoginForm } from "@/components/auth/login-form"
import { SignupForm } from "@/components/auth/signup-form"
import { navigate } from "@/hooks/use-hash-route"

type Step =
  | { name: "login"; email?: string; notice?: string }
  | { name: "signup" }
  | {
      name: "confirm"
      email: string
      password?: string
      from: "login" | "signup"
    }

const stepFor = (name: "login" | "signup"): Step =>
  name === "login" ? { name: "login" } : { name: "signup" }

// Full-page auth screen in the layout of the shadcn "login-03" block:
// muted background, logo, centered card. Routes: #/login, #/signup.
export function AuthPage({ initial }: { initial: "login" | "signup" }) {
  const [step, setStep] = useState<Step>(stepFor(initial))

  // Browser back/forward between #/login and #/signup: follow the URL
  // (state derived from props during render, the React-recommended way).
  const [lastInitial, setLastInitial] = useState(initial)
  if (initial !== lastInitial) {
    setLastInitial(initial)
    if (step.name !== initial) setStep(stepFor(initial))
  }

  const goTo = (next: Step) => {
    setStep(next)
    if (next.name !== "confirm") navigate(`#/${next.name}`)
  }

  const done = () => {
    toast.success("You're logged in")
    navigate("")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate("")}
          className="flex items-center gap-2 self-center font-heading text-lg font-semibold"
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ClockIcon weight="bold" className="size-4" />
          </div>
          What time
        </button>

        {step.name === "login" && (
          <LoginForm
            key={step.email ?? "login"}
            initialEmail={step.email}
            notice={step.notice}
            onDone={done}
            onNeedConfirm={(email, password) =>
              goTo({ name: "confirm", email, password, from: "login" })
            }
            onSignUp={() => goTo({ name: "signup" })}
          />
        )}

        {step.name === "signup" && (
          <SignupForm
            onRegistered={(email, password) =>
              goTo({ name: "confirm", email, password, from: "signup" })
            }
            onLogIn={() => goTo({ name: "login" })}
          />
        )}

        {step.name === "confirm" && (
          <ConfirmForm
            email={step.email}
            // after sign-up Amplify logs in by itself; from the login form we reuse the password
            password={step.from === "login" ? step.password : undefined}
            onDone={done}
            onConfirmedLogInNeeded={() =>
              goTo({
                name: "login",
                email: step.email,
                notice: "Email confirmed - please log in",
              })
            }
            onBack={() => goTo(stepFor(step.from))}
          />
        )}
      </div>
    </div>
  )
}
