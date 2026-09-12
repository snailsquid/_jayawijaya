import { ChevronDown, ChevronRight, Pencil, RefreshCw, Share2, Trash2 } from "lucide-react"
import type { Category, Module } from "@/types/quiz"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface Props { modules: Module[]; selectedIds: string[]; expandedModules: Set<string>; collapsedCategories: Set<string>; cloudEnabled?: boolean; onToggleModule: (id: string) => void; onToggleExpand: (id: string) => void; onDeleteModule: (id: string) => void; onToggleCollapse: (key: string) => void; onToggleSelectAll: (ids: string[], select: boolean) => void; onShare: (module: Module) => void; onEdit: (module: Module) => void; onSync: (id: string) => void; renderCategoryActions?: (category: Category) => ReactNode }

export function ModuleList(props: Props) {
  const categories = Array.from(new Set(props.modules.map(module => module.categoryId).filter(Boolean))).sort() as string[]
  const groups = [
    ...categories.map(title => ({ title, key: title, modules: props.modules.filter(module => module.categoryId === title) })),
    { title: 'Uncategorized', key: '__uncategorized__', modules: props.modules.filter(module => !module.categoryId) },
  ].filter(group => group.modules.length)

  return <div className="space-y-3">{groups.map(group => {
    const collapsed = props.collapsedCategories.has(group.key)
    const ids = group.modules.map(module => module.id)
    const all = ids.every(id => props.selectedIds.includes(id))
    return <Card key={group.key} className="gap-2 py-3">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3">
        <Button variant="ghost" className="min-w-0 justify-start px-1 font-semibold" onClick={() => props.onToggleCollapse(group.key)} aria-expanded={!collapsed}>{collapsed ? <ChevronRight /> : <ChevronDown />}<span className="truncate">{group.title}</span></Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {group.key !== '__uncategorized__' && props.renderCategoryActions?.({ id: group.key, name: group.title, moduleIds: ids })}
          {!collapsed && <Button size="sm" variant="outline" onClick={() => props.onToggleSelectAll(ids, !all)}>{all ? 'Deselect all' : 'Select all'}</Button>}
        </div>
      </CardHeader>
      {!collapsed && <CardContent className="space-y-2 px-3">{group.modules.map(module => {
        const selected = props.selectedIds.includes(module.id)
        const expanded = props.expandedModules.has(module.id)
        const sharingUnavailable = !props.cloudEnabled || (!module.isOwner && !module.shareToken)
        return <div key={module.id} className={cn("flex min-w-0 flex-wrap items-start gap-3 rounded-md border p-3", selected && "border-primary bg-accent")}>
          <Checkbox id={`module-${module.id}`} checked={selected} onCheckedChange={() => props.onToggleModule(module.id)} className="mt-1" />
          <div className="min-w-0 basis-48 flex-1 overflow-hidden">
            <Label htmlFor={`module-${module.id}`} className="block cursor-pointer truncate font-medium">{module.title}</Label>
            <p className="truncate text-xs text-muted-foreground">v{module.currentVersion ?? 1}{module.subscribed ? module.frozen ? ' · frozen' : ' · live subscription' : module.visibility === 'live' ? ' · shared live' : ' · private'}</p>
            {module.description && <Button type="button" variant="link" className={cn("block h-auto max-w-full justify-start overflow-hidden p-0 text-left text-sm font-normal text-muted-foreground", !expanded && "truncate")} onClick={() => props.onToggleExpand(module.id)} aria-expanded={expanded}>{module.description}</Button>}
          </div>
          <div className="ml-auto flex shrink-0 gap-1">
            {module.isOwner && <Button variant="ghost" size="icon-sm" onClick={() => props.onEdit(module)} aria-label={`Edit ${module.title}`}><Pencil /></Button>}
            <Button variant="ghost" size="icon-sm" onClick={() => props.onShare(module)} disabled={sharingUnavailable} title={!props.cloudEnabled ? 'Requires a signed-in internet connection' : undefined} aria-label={sharingUnavailable ? `Sharing unavailable for ${module.title}` : `Share ${module.title}`}><Share2 /></Button>
            {module.subscribed && !module.frozen && <Button variant="ghost" size="icon-sm" disabled={!props.cloudEnabled} onClick={() => props.onSync(module.id)} aria-label={`Update ${module.title}`}><RefreshCw /></Button>}
            <Button variant="ghost" size="icon-sm" onClick={() => props.onDeleteModule(module.id)} aria-label={`Delete ${module.title}`}><Trash2 /></Button>
          </div>
        </div>
      })}</CardContent>}
    </Card>
  })}</div>
}
