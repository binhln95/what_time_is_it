import { useEffect, useState } from "react"
import { SpinnerIcon } from "@phosphor-icons/react"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { toast } from "sonner"
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
} from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { errorMessage } from "@/lib/api"
import { confirmRegistration, resendCode } from "@/lib/auth"

const RESEND_COOLDOWN = 30 // seconds

interface Props {
  email: string
  password?: string
  onDone: () => void
  onConfirmedLogInNeeded: () => void
  onBack: () => void
}

// Enter the 6-digit code Cognito emailed after sign-up.
export function ConfirmForm({
  email,
  password,
  onDone,
  onConfirmedLogInNeeded,
  onBack,
}: Props) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function verify(value: string) {
    setError(null)
    setPending(true)
    try {
      if (await confirmRegistration(email, value, password)) onDone()
      else onConfirmedLogInNeeded()
    } catch (err) {
      setError(errorMessage(err))
      setCode("")
    } finally {
      setPending(false)
    }
  }

  async function resend() {
    try {
      await resendCode(email)
      setCooldown(RESEND_COOLDOWN)
      toast.success("A new code is on its way")
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Check your email</CardTitle>
        <CardDescription>
          Enter the 6-digit code we sent to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length === 6) verify(code)
          }}
        >
          <FieldGroup>
            <Field className="items-center">
              <InputOTP
                containerClassName="justify-center"
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                value={code}
                onChange={setCode}
                onComplete={verify} // submit as soon as the 6th digit is typed
                disabled={pending}
                autoFocus
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </Field>
            {error && <FieldError className="text-center">{error}</FieldError>}
            <Field>
              <Button type="submit" disabled={pending || code.length !== 6}>
                {pending && (
                  <SpinnerIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                )}
                Verify
              </Button>
              <FieldDescription className="text-center">
                Didn&apos;t get it?{" "}
                {cooldown > 0 ? (
                  <span>Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={resend}
                  >
                    Resend code
                  </button>
                )}
                {" · "}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={onBack}
                >
                  Use another email
                </button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
