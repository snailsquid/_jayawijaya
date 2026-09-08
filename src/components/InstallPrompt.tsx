import { Download, X } from "lucide-react"
import { usePWAInstall } from "@/hooks/usePWAInstall"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function InstallPrompt() {
  const { canInstall, showHint, install, dismiss } = usePWAInstall()
  if (!showHint || !canInstall) return null
  return <Alert className="relative max-w-md pr-12"><Download className="size-4" /><AlertTitle>Install _jayawijaya</AlertTitle><AlertDescription className="space-y-3">
    <p>Install this app for quick access and offline use.</p>
    <Button size="sm" onClick={install}><Download /> Install app</Button>
  </AlertDescription><Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" onClick={dismiss} aria-label="Dismiss install prompt"><X /></Button></Alert>
}
