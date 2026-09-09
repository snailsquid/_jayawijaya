import { Laptop, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTheme, type Theme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Laptop
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Choose color theme"><Icon /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
    {([['light', Sun], ['dark', Moon], ['system', Laptop]] as const).map(([value, ItemIcon]) => <DropdownMenuItem key={value} onClick={() => setTheme(value as Theme)}><ItemIcon /> <span className="capitalize">{value}</span></DropdownMenuItem>)}
  </DropdownMenuContent></DropdownMenu>
}
