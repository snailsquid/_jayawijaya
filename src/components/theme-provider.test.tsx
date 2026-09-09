import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ThemeProvider, useTheme } from "@/components/theme-provider"

function Consumer() { const { theme, setTheme } = useTheme(); return <button onClick={() => setTheme('dark')}>{theme}</button> }
describe('ThemeProvider', () => { it('persists and applies a chosen theme', async () => { localStorage.clear(); render(<ThemeProvider><Consumer /></ThemeProvider>); await userEvent.click(screen.getByRole('button')); expect(document.documentElement).toHaveClass('dark'); expect(localStorage.getItem('jayawijaya-theme')).toBe('dark') }) })
