import { useState, type FormEvent } from "react"
import { PlusIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimezoneCombobox } from "@/components/timezone-combobox"
import { api, errorMessage } from "@/lib/api"
import {
  browserTimeZone,
  formatDate,
  formatTime,
  zonedLocalToUtc,
} from "@/lib/time"
import type { CreatedMeeting } from "@/lib/types"

interface ParticipantRow {
  key: number
  name: string
  timezone: string
}

let nextKey = 1

const initialState = () => ({
  title: "",
  start: "",
  timezone: browserTimeZone,
  durationMinutes: 30,
  remindBeforeMinutes: 15,
  participants: [] as ParticipantRow[],
})

export function MeetingForm({
  onCreated,
}: {
  onCreated: (m: CreatedMeeting) => void
}) {
  const [form, setForm] = useState(initialState)
  const [submitting, setSubmitting] = useState(false)
  const set = <K extends keyof ReturnType<typeof initialState>>(
    key: K,
    value: ReturnType<typeof initialState>[K]
  ) => setForm((f) => ({ ...f, [key]: value }))

  const updateParticipant = (key: number, patch: Partial<ParticipantRow>) =>
    set(
      "participants",
      form.participants.map((p) => (p.key === key ? { ...p, ...patch } : p))
    )

  // Live preview of the start time in each participant's timezone.
  const startUtc = form.start
    ? zonedLocalToUtc(form.start, form.timezone)
    : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.participants.some((p) => !p.name.trim() || !p.timezone)) {
      toast.error("Every participant needs a name and a timezone")
      return
    }
    setSubmitting(true)
    try {
      const meeting = await api.createMeeting({
        title: form.title,
        start: form.start,
        timezone: form.timezone,
        durationMinutes: form.durationMinutes,
        remindBeforeMinutes: form.remindBeforeMinutes,
        participants: form.participants.map(({ name, timezone }) => ({
          name: name.trim(),
          timezone,
        })),
      })
      if (meeting.subscription === "pending-confirmation") {
        toast.success("Meeting created", {
          description:
            "Check your inbox and confirm the AWS notification subscription to receive reminders.",
          duration: 10_000,
        })
      } else {
        toast.success("Meeting created", {
          description: "A reminder email will be sent before it starts.",
        })
      }
      setForm(initialState())
      onCreated(meeting)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New meeting</CardTitle>
        <CardDescription>
          Pick a time in your timezone. We email you a reminder before it
          starts.
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit} className="contents">
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              maxLength={100}
              placeholder="Sprint review"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="datetime-local"
                required
                value={form.start}
                onChange={(e) => set("start", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <TimezoneCombobox
                id="timezone"
                value={form.timezone}
                onChange={(tz) => set("timezone", tz)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={1440}
                required
                value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", e.target.valueAsNumber)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remind">Remind me before (minutes)</Label>
              <Input
                id="remind"
                type="number"
                min={0}
                max={1440}
                required
                value={form.remindBeforeMinutes}
                onChange={(e) =>
                  set("remindBeforeMinutes", e.target.valueAsNumber)
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Participants</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={form.participants.length >= 20}
                onClick={() =>
                  set("participants", [
                    ...form.participants,
                    { key: nextKey++, name: "", timezone: "" },
                  ])
                }
              >
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
            {form.participants.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add people to see the meeting in their local time.
              </p>
            )}
            {form.participants.map((p) => {
              const preview =
                startUtc !== null && p.timezone
                  ? `${formatDate(startUtc, p.timezone)}, ${formatTime(startUtc, p.timezone)}`
                  : null
              return (
                <div key={p.key} className="grid gap-1">
                  <div className="flex gap-2">
                    <Input
                      aria-label="Participant name"
                      placeholder="Name"
                      maxLength={50}
                      className="w-32 shrink-0 sm:w-40"
                      value={p.name}
                      onChange={(e) =>
                        updateParticipant(p.key, { name: e.target.value })
                      }
                    />
                    <TimezoneCombobox
                      className="min-w-0 flex-1"
                      value={p.timezone}
                      onChange={(tz) =>
                        updateParticipant(p.key, { timezone: tz })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove participant"
                      onClick={() =>
                        set(
                          "participants",
                          form.participants.filter((x) => x.key !== p.key)
                        )
                      }
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                  {preview && (
                    <p className="pl-1 text-xs text-muted-foreground">
                      Their time: {preview}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            {submitting && (
              <SpinnerIcon data-icon="inline-start" className="animate-spin" />
            )}
            Create meeting
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
