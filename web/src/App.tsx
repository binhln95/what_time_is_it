import {
  BellIcon,
  CalendarDotsIcon,
  GlobeHemisphereEastIcon,
  SignInIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { AppHeader } from "@/components/app-header"
import { LiveClock } from "@/components/live-clock"
import { Meetings } from "@/components/meetings"
import { WorldClock } from "@/components/world-clock"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { useSession } from "@/hooks/use-session"
import { login } from "@/lib/auth"
import { config } from "@/lib/config"

const FEATURES = [
  {
    icon: GlobeHemisphereEastIcon,
    title: "World clock",
    text: "Save the timezones of your team and see their time at a glance.",
  },
  {
    icon: CalendarDotsIcon,
    title: "Meeting planner",
    text: "See a meeting in every participant's local time before you send it.",
  },
  {
    icon: BellIcon,
    title: "Email reminders",
    text: "Get an email before each meeting, on time in your timezone.",
  },
]

function SignInCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Plan across timezones</CardTitle>
        <CardDescription>
          Log in to save favorite timezones and schedule meeting reminders.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="grid gap-1.5">
              <Icon className="size-6 text-primary" />
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <Button className="w-fit" onClick={login} disabled={!config}>
          <SignInIcon data-icon="inline-start" />
          Log in or sign up
        </Button>
      </CardContent>
    </Card>
  )
}

function MissingConfig() {
  return (
    <Card className="ring-destructive/40">
      <CardContent className="flex gap-3">
        <WarningIcon className="size-5 shrink-0 text-destructive" />
        <div className="text-sm">
          <p className="font-medium">Missing runtime config</p>
          <p className="text-muted-foreground">
            Deploy the stack, then run{" "}
            <code className="font-mono">npm run web:config</code> in the project
            root to generate{" "}
            <code className="font-mono">web/public/config.js</code>.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function App() {
  const { session, ready } = useSession()

  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6">
        {!config && <MissingConfig />}
        <LiveClock />
        {!ready ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : session ? (
          <Tabs
            // remember the open tab in the URL hash (#meetings) so a reload keeps it
            defaultValue={
              window.location.hash === "#meetings" ? "meetings" : "world"
            }
            onValueChange={(tab) =>
              window.history.replaceState(
                null,
                "",
                tab === "meetings" ? "#meetings" : "/"
              )
            }
            className="gap-4"
          >
            <TabsList>
              <TabsTrigger value="world">
                <GlobeHemisphereEastIcon />
                World clock
              </TabsTrigger>
              <TabsTrigger value="meetings">
                <CalendarDotsIcon />
                Meetings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="world">
              <WorldClock />
            </TabsContent>
            <TabsContent value="meetings">
              <Meetings />
            </TabsContent>
          </Tabs>
        ) : (
          <SignInCard />
        )}
      </main>
      <Toaster position="top-center" />
    </div>
  )
}

export default App
