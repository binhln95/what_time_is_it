// Runtime config injected by /config.js (see scripts/web.mjs), so the same build
// works for every stack (dev / prod).

export interface AppConfig {
  apiUrl: string
  cognitoDomain: string
  userPoolClientId: string
}

declare global {
  interface Window {
    APP_CONFIG?: AppConfig
  }
}

export const config: AppConfig | undefined = window.APP_CONFIG
