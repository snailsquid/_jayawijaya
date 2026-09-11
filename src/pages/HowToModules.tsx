import { useState } from "react"
import { ArrowLeft, Check, Copy, ExternalLink } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { PageHeader, PageShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { navigateBackOr } from "@/lib/frontend-display"

const LLM_PROMPT = `Follow the instructions below step by step: https://raw.githubusercontent.com/snailsquid/_jayawijaya/master/LLM_TUTORIAL.md`
export function HowToModules() {
  const navigate = useNavigate(); const [copied, setCopied] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(LLM_PROMPT); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { /* textarea remains selectable */ } }
  return <PageShell className="max-w-3xl"><PageHeader title="How to create modules" actions={<Button variant="outline" onClick={() => navigateBackOr(navigate, '/')}><ArrowLeft /> Back</Button>} />
    <Card><CardHeader><div className="flex items-center gap-2"><Badge>1</Badge><CardTitle>LLM prompt</CardTitle></div><CardDescription>Copy this prompt into an LLM, or open the raw instructions.</CardDescription></CardHeader><CardContent className="space-y-4"><Textarea readOnly value={LLM_PROMPT} onFocus={e => e.currentTarget.select()} className="min-h-24 font-mono" /><div className="flex flex-wrap items-center gap-3"><Button onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy prompt'}</Button><Button variant="link" asChild><a href="https://raw.githubusercontent.com/snailsquid/_jayawijaya/master/LLM_TUTORIAL.md" target="_blank" rel="noreferrer">Raw instructions <ExternalLink /></a></Button><span className="sr-only" aria-live="polite">{copied ? 'Prompt copied to clipboard' : ''}</span></div></CardContent></Card>
    <Card><CardHeader><div className="flex items-center gap-2"><Badge variant="secondary">2</Badge><CardTitle>Manual</CardTitle></div><CardDescription>Inspect an example YAML module.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button asChild><a href="/example_module.yaml" target="_blank">Example YAML <ExternalLink /></a></Button><Button variant="outline" asChild><a href="https://github.com/snailsquid/_jayawijaya/blob/master/example_module.yaml" target="_blank" rel="noreferrer">View on GitHub <ExternalLink /></a></Button></CardContent></Card>
  </PageShell>
}
