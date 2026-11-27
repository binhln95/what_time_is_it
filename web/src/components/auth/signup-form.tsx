import { useState, type FormEvent } from "react"
import { SpinnerIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/api"
import { register } from "@/lib/auth"

const MIN_PASSWORD = 8 // Cognito user pool policy (template.yaml)

interface Props {
  onRegistered: (email: string, password: string) => void
  onLogIn: () => void
}

// Based on the shadcn "signup-03" block, without the social buttons.
export function SignupForm({ onRegistered, onLogIn }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setPending(true)
    try {
      await register(email.trim(), password)
      onRegistered(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Save your timezones and get meeting reminders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <FieldDescription>
                We&apos;ll send a code to confirm it. Reminders go here too.
              </FieldDescription>
            </Field>
            <Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </Field>
              </div>
              <FieldDescription>
                Must be at least {MIN_PASSWORD} characters long.
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Field>
              <Button type="submit" disabled={pending}>
                {pending && (
                  <SpinnerIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                )}
                Create account
              </Button>
              <FieldDescription className="text-center">
                Already have an account?{" "}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={onLogIn}
                >
                  Log in
                </button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
