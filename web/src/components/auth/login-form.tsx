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
import { logIn } from "@/lib/auth"

interface Props {
  initialEmail?: string
  notice?: string
  onDone: () => void
  onNeedConfirm: (email: string, password: string) => void
  onSignUp: () => void
}

// Based on the shadcn "login-03" block, without the social buttons.
export function LoginForm({
  initialEmail = "",
  notice,
  onDone,
  onNeedConfirm,
  onSignUp,
}: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const result = await logIn(email.trim(), password)
      if (result === "done") onDone()
      else onNeedConfirm(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>
          {notice ?? "Log in with your email and password"}
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
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
                Log in
              </Button>
              <FieldDescription className="text-center">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={onSignUp}
                >
                  Sign up
                </button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
