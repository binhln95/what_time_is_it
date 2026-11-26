import { useState, type ReactNode } from "react"
import { CaretUpDownIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { allTimeZones } from "@/lib/time"

interface Props {
  value?: string
  onChange: (tz: string) => void
  placeholder?: ReactNode
  exclude?: string[]
  disabled?: boolean
  className?: string
  id?: string
}

// Searchable list of every IANA timezone the browser knows.
export function TimezoneCombobox({
  value,
  onChange,
  placeholder = "Select timezone",
  exclude = [],
  disabled,
  className,
  id,
}: Props) {
  const [open, setOpen] = useState(false)
  const zones = exclude.length
    ? allTimeZones.filter((tz) => !exclude.includes(tz))
    : allTimeZones

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("justify-between font-normal", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <CaretUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-72 p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {zones.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  data-checked={tz === value}
                  onSelect={() => {
                    onChange(tz)
                    setOpen(false)
                  }}
                >
                  {tz}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
