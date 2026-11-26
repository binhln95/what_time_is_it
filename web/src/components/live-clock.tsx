import { useEffect, useState } from "react"
import {
  CloudSlashIcon,
  DesktopIcon,
  MapPinIcon,
  SpinnerIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"
import { api, errorMessage } from "@/lib/api"
import {
  geoPermission,
  getPosition,
  isPermissionDenied,
  type Coords,
  type GeoPermission,
} from "@/lib/geo"
import {
  browserTimeZone,
  formatLongDate,
  formatOffset,
  formatTime,
  offsetMinutes,
} from "@/lib/time"
import type { TimeInfo } from "@/lib/types"

// Big clock. On page load it asks for the location (the browser shows its permission
// prompt the first time), then GET /time:
//   - location allowed: sends lat/lon, the server looks up the timezone of that place
//     (VN -> UTC+7, Singapore -> UTC+8)
//   - refused / unavailable: sends the device timezone setting instead
// While waiting for the answer the clock already ticks in the device timezone.
// The server time is fetched once; the clock then ticks locally using the measured offset.
export function LiveClock() {
  const now = useNow(250)
  const [info, setInfo] = useState<TimeInfo | null>(null)
  const [offsetMs, setOffsetMs] = useState(0)
  const [apiDown, setApiDown] = useState(false)
  const [permission, setPermission] = useState<GeoPermission | null>(null)
  const [locating, setLocating] = useState(false)

  async function sync(where: Parameters<typeof api.time>[0]) {
    const sentAt = Date.now()
    const t = await api.time(where)
    const latency = (Date.now() - sentAt) / 2
    setOffsetMs(Date.parse(t.utcDatetime) + latency - Date.now())
    setInfo(t)
    setApiDown(false)
  }

  async function locateMe() {
    setLocating(true)
    try {
      await sync(await getPosition())
      setPermission("granted")
    } catch (err) {
      setPermission(await geoPermission())
      toast.error(errorMessage(err))
    } finally {
      setLocating(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const perm = await geoPermission()
      if (cancelled) return
      setPermission(perm)

      // 1. Ask for the position on load (prompts if the user has not decided yet).
      let position: Coords | null = null
      if (perm === "prompt" || perm === "granted") {
        setLocating(true)
        try {
          position = await getPosition()
        } catch (err) {
          if (cancelled) return
          if (isPermissionDenied(err)) setPermission("denied")
          else
            toast.warning(
              `${errorMessage(err)}, using your device timezone instead`
            )
        } finally {
          if (!cancelled) setLocating(false)
        }
      }
      if (cancelled) return

      // 2. Time for that position, or for the device timezone as a fallback.
      try {
        await sync(position ?? { tz: browserTimeZone })
        if (position) setPermission("granted")
      } catch {
        if (!cancelled) setApiDown(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tz = info?.timezone ?? browserTimeZone
  const fromLocation = info?.source === "location"
  const t = now + offsetMs

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {fromLocation ? "Local time at your location" : "Your local time"}
          </p>
          <p className="font-heading text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl">
            {formatTime(t, tz, true)}
          </p>
          <p className="mt-1 text-muted-foreground">{formatLongDate(t, tz)}</p>
          {fromLocation && tz !== browserTimeZone && (
            <p className="mt-1 text-xs text-muted-foreground">
              Your device is set to {browserTimeZone} (
              {formatOffset(offsetMinutes(t, browserTimeZone))}).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge variant="secondary">{tz}</Badge>
            <Badge variant="outline">
              {formatOffset(offsetMinutes(t, tz))}
            </Badge>
            {apiDown ? (
              <Badge variant="destructive">
                <CloudSlashIcon data-icon="inline-start" />
                API unreachable
              </Badge>
            ) : !info && locating ? (
              <Badge variant="outline">
                <SpinnerIcon
                  data-icon="inline-start"
                  className="animate-spin"
                />
                Waiting for location permission
              </Badge>
            ) : (
              info && (
                <Badge variant="outline">
                  {fromLocation ? (
                    <MapPinIcon data-icon="inline-start" />
                  ) : (
                    <DesktopIcon data-icon="inline-start" />
                  )}
                  {fromLocation ? "From your location" : "From device settings"}
                </Badge>
              )
            )}
          </div>

          {!fromLocation &&
            (permission === "prompt" || permission === "granted") && (
              <Button
                variant="outline"
                size="sm"
                onClick={locateMe}
                disabled={locating}
              >
                {locating ? (
                  <SpinnerIcon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <MapPinIcon data-icon="inline-start" />
                )}
                Use my location
              </Button>
            )}
          {!fromLocation && permission === "denied" && (
            <p className="text-xs text-muted-foreground">
              Location is blocked - allow it in the browser&apos;s site
              settings.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
