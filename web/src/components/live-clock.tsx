import { useEffect, useState } from "react"
import { CloudCheckIcon, CloudSlashIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import { api } from "@/lib/api"
import {
  browserTimeZone,
  formatLongDate,
  formatOffset,
  formatTime,
  offsetMinutes,
} from "@/lib/time"

// Big clock for the browser's timezone. GET /time (public) gives the server time once;
// the clock then ticks locally using the measured offset.
export function LiveClock() {
  const now = useNow(250)
  const [offsetMs, setOffsetMs] = useState(0)
  const [synced, setSynced] = useState<boolean | null>(null)

  useEffect(() => {
    const sentAt = Date.now()
    api
      .time(browserTimeZone)
      .then((t) => {
        const latency = (Date.now() - sentAt) / 2
        setOffsetMs(Date.parse(t.utcDatetime) + latency - Date.now())
        setSynced(true)
      })
      .catch(() => setSynced(false))
  }, [])

  const t = now + offsetMs

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Your local time</p>
          <p className="font-heading text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl">
            {formatTime(t, browserTimeZone, true)}
          </p>
          <p className="mt-1 text-muted-foreground">
            {formatLongDate(t, browserTimeZone)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Badge variant="secondary">{browserTimeZone}</Badge>
          <Badge variant="outline">
            {formatOffset(offsetMinutes(t, browserTimeZone))}
          </Badge>
          {synced === true && (
            <Badge variant="outline">
              <CloudCheckIcon data-icon="inline-start" />
              Synced with API
            </Badge>
          )}
          {synced === false && (
            <Badge variant="destructive">
              <CloudSlashIcon data-icon="inline-start" />
              API unreachable
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
