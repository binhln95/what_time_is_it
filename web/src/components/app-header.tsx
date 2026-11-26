import {
  ClockIcon,
  MoonIcon,
  SignInIcon,
  SignOutIcon,
  SunIcon,
} from "@phosphor-icons/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"
import { useSession } from "@/hooks/use-session"
import { login, logout } from "@/lib/auth"
import { config } from "@/lib/config"

function ThemeToggle() {
  const { setTheme } = useTheme()
  const toggle = () =>
    setTheme(
      document.documentElement.classList.contains("dark") ? "light" : "dark"
    )
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}

export function AppHeader() {
  const { session, ready } = useSession()

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ClockIcon weight="bold" />
          </div>
          <span className="font-heading text-lg font-semibold">What time</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account">
                  <Avatar className="size-8">
                    <AvatarFallback>
                      {session.email.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-xs text-muted-foreground">
                    Signed in as
                  </div>
                  <div className="truncate">{session.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}>
                  <SignOutIcon />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={login} disabled={!ready || !config}>
              <SignInIcon data-icon="inline-start" />
              Log in
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
