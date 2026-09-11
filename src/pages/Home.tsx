import { BookOpen, CreditCard, Play, UserRound } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { InstallPrompt } from "@/components/InstallPrompt"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import hero from "@/assets/hero.png"
import { isAcromionHostname } from "@/lib/frontend-display"

export function Home() {
  const navigate = useNavigate()
  const isAcromion = isAcromionHostname(window.location.hostname)
  return <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
    <div className="absolute right-4 top-4 flex items-center gap-2"><Button variant="outline" onClick={() => navigate('/account')}><UserRound /> Account</Button><ThemeToggle /></div>
    <div className="space-y-3">
      {isAcromion ? <img src={hero} alt="Acromion" className="mx-auto h-auto w-52 sm:w-64" /> : <h1 className="text-5xl font-black tracking-tighter sm:text-7xl">_jayawijaya</h1>}
      {isAcromion
        ? <p className="mx-auto max-w-md text-muted-foreground"><a className="font-semibold underline underline-offset-4" href="https://jw.arkk.dev">_jayawijaya</a>, made for <a className="font-semibold underline underline-offset-4" href="https://www.instagram.com/acromion2024/">acromion.org</a></p>
        : <p className="mx-auto max-w-md text-muted-foreground">A modular quiz app with practice and exam modes, multiple-choice and text answers, and local persistence.</p>}
    </div>
    <p className="text-sm text-muted-foreground">by <a className="font-semibold underline underline-offset-4" href="https://www.linkedin.com/in/arkandhiya-ibrahim-dewantara-576059235/">ark</a>, <a href="https://jambee.games" className="italic underline underline-offset-4">Jambee</a> cofounder</p>
    <div className="flex w-full max-w-xs flex-col gap-3"><Button size="lg" onClick={() => navigate('/start')}><Play /> Start</Button><Button variant="secondary" onClick={() => navigate('/pricing')}><CreditCard /> Pricing</Button><Button variant="outline" onClick={() => navigate('/how-to-create-modules')}><BookOpen /> How to create modules?</Button></div>
    <InstallPrompt />
  </main>
}
