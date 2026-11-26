import { useCallback, useEffect, useState } from "react"
import { CalendarDotsIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MeetingDetailDialog } from "@/components/meeting-detail-dialog"
import { MeetingForm } from "@/components/meeting-form"
import { useNow } from "@/hooks/use-now"
import { api, errorMessage } from "@/lib/api"
import { browserTimeZone, formatDate, formatTime } from "@/lib/time"
import type { Meeting, MeetingDetail } from "@/lib/types"

export function Meetings() {
  const now = useNow(30_000)
  const [meetings, setMeetings] = useState<Meeting[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [created, setCreated] = useState<MeetingDetail | null>(null)

  const load = useCallback(() => {
    api
      .meetings()
      .then((r) => setMeetings(r.meetings))
      .catch((err) => {
        toast.error(errorMessage(err))
        setMeetings([])
      })
  }, [])

  useEffect(load, [load])
  const close = useCallback(() => setOpenId(null), [])

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <MeetingForm
        onCreated={(m) => {
          setCreated(m)
          setOpenId(m.id)
          load()
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>My meetings</CardTitle>
          <CardDescription>
            Times shown in your timezone ({browserTimeZone}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meetings === null ? (
            <div className="grid gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <CalendarDotsIcon className="size-8 text-muted-foreground" />
              <p className="font-medium">No meetings yet</p>
              <p className="text-sm text-muted-foreground">
                Create one and it shows up here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((m) => {
                  const start = Date.parse(m.startUtc)
                  const past = start + m.durationMinutes * 60_000 < now
                  return (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer"
                      onClick={() => setOpenId(m.id)}
                    >
                      <TableCell className="max-w-40 truncate font-medium">
                        {m.title}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(start, browserTimeZone)},{" "}
                        {formatTime(start, browserTimeZone)}
                      </TableCell>
                      <TableCell className="text-right">
                        {past ? (
                          <Badge variant="secondary">Done</Badge>
                        ) : Date.parse(m.remindAtUtc) > now ? (
                          <Badge variant="outline">Reminder set</Badge>
                        ) : (
                          <Badge>Reminded</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MeetingDetailDialog
        meetingId={openId}
        initial={created}
        onClose={close}
      />
    </div>
  )
}
