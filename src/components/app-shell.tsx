import type { ReactNode } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

export function PageShell({ children, className }: { children: ReactNode; className?: string }) { return <main className={cn("mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-4 sm:p-6", className)}>{children}</main> }
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) { return <header className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><div className="flex items-center gap-2">{actions}<ThemeToggle /></div></header> }
