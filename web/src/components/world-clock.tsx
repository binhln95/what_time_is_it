import { useEffect, useState } from "react"
import { GlobeHemisphereEastIcon, PlusIcon, XIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TimezoneCombobox } from "@/components/timezone-combobox"
import { useNow } from "@/hooks/use-now"
import { api, errorMessage } from "@/lib/api"
import {
  cityName,
  formatDate,
  formatOffset,
  formatTime,
  offsetMinutes,
  relativeToLocal,
} from "@/lib/time"

const MAX_FAVORITES = 20

// Favorite timezones: GET/PUT /favorites (stored in DynamoDB), ticking locally.
export function WorldClock() {
  const now = useNow(1000)
  const [zones, setZones] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .favorites()
      .then((r) => setZones(r.favorites.map((f) => f.timezone)))
      .catch((err) => {
        toast.error(errorMessage(err))
        setZones([])
      })
  }, [])

  async function save(next: string[]) {
    setSaving(true)
    try {
      const r = await api.saveFavorites(next)
      setZones(r.favorites.map((f) => f.timezone))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>World clock</CardTitle>
        <CardDescription>
          Your favorite timezones, saved to your account.
        </CardDescription>
        <CardAction>
          <TimezoneCombobox
            onChange={(tz) => save([...(zones ?? []), tz])}
            exclude={zones ?? []}
            disabled={zones === null || saving || zones.length >= MAX_FAVORITES}
            placeholder={
              <span className="flex items-center gap-1.5 text-foreground">
                <PlusIcon /> Add timezone
              </span>
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {zones === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : zones.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <GlobeHemisphereEastIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">No favorites yet</p>
            <p className="text-sm text-muted-foreground">
              Add a timezone to see its local time here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((tz) => (
              <div key={tz} className="group relative rounded-lg border p-4">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-2 right-2 opacity-60 group-hover:opacity-100"
                  aria-label={`Remove ${tz}`}
                  disabled={saving}
                  onClick={() => save(zones.filter((z) => z !== tz))}
                >
                  <XIcon />
                </Button>
                <p className="pr-6 font-medium">{cityName(tz)}</p>
                <p className="truncate text-xs text-muted-foreground">{tz}</p>
                <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">
                  {formatTime(now, tz)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(now, tz)}</span>
                  <Badge variant="outline">
                    {formatOffset(offsetMinutes(now, tz))}
                  </Badge>
                  <Badge variant="secondary">{relativeToLocal(now, tz)}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
