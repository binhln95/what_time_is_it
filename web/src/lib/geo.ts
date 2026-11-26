// Browser Geolocation helpers.

export type GeoPermission = "granted" | "prompt" | "denied" | "unsupported"

export interface Coords {
  lat: number
  lon: number
}

// Current permission without triggering the browser prompt.
export async function geoPermission(): Promise<GeoPermission> {
  if (!("geolocation" in navigator)) return "unsupported"
  try {
    const status = await navigator.permissions.query({ name: "geolocation" })
    return status.state
  } catch {
    return "prompt" // Permissions API not available (older Safari): asking is the only way to know
  }
}

// Asks for the position (shows the browser prompt the first time).
// Coordinates are rounded to 2 decimals (~1 km): plenty to find a timezone, and the
// exact position never leaves the browser.
export function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied"
              : "Could not get your location"
          )
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 }
    )
  })
}
