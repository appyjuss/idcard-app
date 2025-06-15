// src/components/ThemeProvider.tsx
import { createContext, useContext, useEffect, useState } from "react"

// Define the possible theme values
type Theme = "dark" | "light" | "system"

// Define the shape of the props for our provider component
type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

// Define the state that our context will provide
type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

// Set the initial state for the context
const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

// Create the actual React Context
const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    // On initial load, try to get the theme from localStorage.
    // If it's not there, use the defaultTheme prop.
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement

    // Remove any existing theme classes
    root.classList.remove("light", "dark")

    // If the theme is "system", figure out what the OS theme is and apply it
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    // Otherwise, just add the chosen theme's class (e.g., "dark" or "light")
    root.classList.add(theme)
  }, [theme]) // This effect re-runs every time the theme state changes

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      // When setTheme is called, update localStorage and the component's state
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

// Export a custom hook for easy access to the theme context
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}