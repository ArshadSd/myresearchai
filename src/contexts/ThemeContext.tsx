import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeName = "midnight" | "ocean" | "forest" | "sunset" | "lavender" | "slate" | "rose" | "amber";

type ThemeContextType = {
  theme: "dark" | "light";
  themeName: ThemeName;
  toggleTheme: () => void;
  setThemeName: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_OPTIONS: { name: ThemeName; label: string; preview: string }[] = [
  { name: "midnight", label: "Midnight", preview: "hsl(228, 25%, 12%)" },
  { name: "ocean", label: "Ocean", preview: "hsl(210, 30%, 12%)" },
  { name: "forest", label: "Forest", preview: "hsl(150, 20%, 10%)" },
  { name: "sunset", label: "Sunset", preview: "hsl(15, 25%, 12%)" },
  { name: "lavender", label: "Lavender", preview: "hsl(270, 20%, 14%)" },
  { name: "slate", label: "Slate", preview: "hsl(220, 10%, 14%)" },
  { name: "rose", label: "Rose", preview: "hsl(345, 20%, 12%)" },
  { name: "amber", label: "Amber", preview: "hsl(35, 25%, 10%)" },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  const [themeName, setThemeNameState] = useState<ThemeName>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("themeName") as ThemeName) || "midnight";
    }
    return "midnight";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    THEME_OPTIONS.forEach((t) => root.classList.remove(`theme-${t.name}`));
    root.classList.add(`theme-${themeName}`);
    localStorage.setItem("themeName", themeName);
  }, [themeName]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  const setThemeName = (name: ThemeName) => setThemeNameState(name);

  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
