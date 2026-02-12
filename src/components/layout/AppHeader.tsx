import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b border-border/30 glass flex items-center justify-between px-6">
      <div />
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
        {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
      </Button>
    </header>
  );
}
