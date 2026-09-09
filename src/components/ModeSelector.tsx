import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { QuizMode } from "@/types/quiz"

export function ModeSelector({ mode, onChange }: { mode: QuizMode; onChange: (mode: QuizMode) => void }) {
  return <RadioGroup value={mode} onValueChange={value => onChange(value as QuizMode)} className="grid grid-cols-2 gap-3">
    {(['practice', 'exam'] as const).map(value => <Label key={value} htmlFor={`mode-${value}`} className="flex cursor-pointer items-center gap-3 rounded-md border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent"><RadioGroupItem id={`mode-${value}`} value={value} /><span className="capitalize">{value}</span></Label>)}
  </RadioGroup>
}
