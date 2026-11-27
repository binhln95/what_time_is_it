import { clearSession, getSession } from "@/lib/auth"
import { config } from "@/lib/config"
import type {
  CreatedMeeting,
  Meeting,
  MeetingDetail,
  MeetingInput,
  TimeInfo,
} from "@/lib/types"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!config)
    throw new ApiError(0, "Missing config.js - run `npm run web:config`")

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const session = await getSession() // refreshes the token if it expired
  if (session) headers.Authorization = `Bearer ${session.token}`

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) clearSession() // token expired / invalid -> back to logged-out state
  if (!res.ok)
    throw new ApiError(res.status, data.message ?? `HTTP ${res.status}`)
  return data as T
}

export const api = {
  // GET /time
  //   { lat, lon } -> timezone of that point
  //   { tz }       -> that timezone
  //   "ip"         -> no parameters: the server locates the caller by IP address
  time: (where: { lat: number; lon: number } | { tz: string } | "ip") =>
    request<TimeInfo>(
      where === "ip"
        ? "/time"
        : `/time?${new URLSearchParams("tz" in where ? { tz: where.tz } : { lat: String(where.lat), lon: String(where.lon) })}`
    ),
  favorites: () => request<{ favorites: TimeInfo[] }>("/favorites"),
  saveFavorites: (timezones: string[]) =>
    request<{ favorites: TimeInfo[] }>("/favorites", {
      method: "PUT",
      body: { timezones },
    }),
  meetings: () => request<{ meetings: Meeting[] }>("/meetings"),
  meeting: (id: string) => request<MeetingDetail>(`/meetings/${id}`),
  createMeeting: (input: MeetingInput) =>
    request<CreatedMeeting>("/meetings", { method: "POST", body: input }),
}

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err)
