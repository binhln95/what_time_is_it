import { useEffect, useState } from "react"
import { BellIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useNow } from "@/hooks/use-now"
import { api, errorMessage } from "@/lib/api"
import { browserTimeZone, formatDate, formatTime } from "@/lib/time"
import type { MeetingDetail } from "@/lib/types"

interface Props {
  meetingId: string | null
  // A meeting already in hand (e.g. just created) - skips the GET /meetings/{id} call.
  initial?: MeetingDetail | null
  onClose: () => void
}

export function MeetingDetailDialog({ meetingId, initial, onClose }: Props) {
  return (
    <Dialog
      open={meetingId !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-2xl">
        {meetingId && (
          // keyed so the body (and its state) is recreated for every meeting
          <MeetingDetailBody
            key={meetingId}
            meetingId={meetingId}
            initial={initial?.id === meetingId ? initial : null}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MeetingDetailBody({
  meetingId,
  initial,
  onClose,
}: {
  meetingId: string
  initial: MeetingDetail | null
  onClose: () => void
}) {
  const now = useNow(30_000)
  const [meeting, setMeeting] = useState(initial)

  useEffect(() => {
    if (initial) return
    api
      .meeting(meetingId)
      .then(setMeeting)
      .catch((err) => {
        toast.error(errorMessage(err))
        onClose()
      })
  }, [meetingId, initial, onClose])

  if (!meeting) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Loading...</DialogTitle>
          <DialogDescription>Fetching meeting details</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </>
    )
  }

  const remindAt = Date.parse(meeting.remindAtUtc)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{meeting.title}</DialogTitle>
        <DialogDescription>
          {meeting.durationMinutes} min - organized in {meeting.timezone}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Who</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Local time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meeting.times.map((t, i) => (
              <TableRow key={`${t.name}-${i}`}>
                <TableCell className="font-medium">
                  {i === 0 ? "You (organizer)" : t.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.timezone}{" "}
                  <span className="text-xs">(UTC{t.utcOffset})</span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {t.start} - {t.end.slice(-5)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <BellIcon />
          Reminder {remindAt > now ? "scheduled for" : "sent at"}
          <Badge variant="outline">
            {formatDate(remindAt, browserTimeZone)},{" "}
            {formatTime(remindAt, browserTimeZone)}
          </Badge>
          (your time)
        </div>
      </div>
    </>
  )
}
