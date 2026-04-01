import { useState } from "react";
import { Moon, Sun, Brain, Globe2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme, THEME_OPTIONS, type ThemeName } from "@/contexts/ThemeContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { theme, themeName, toggleTheme, setThemeName } = useTheme();
  const [domainMode, setDomainMode] = useState(false);

  (window as any).__domainMode = domainMode;

  return (
    <header className="h-14 border-b border-border/30 bg-card/60 backdrop-blur-xl flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="domain-mode" className="text-xs text-muted-foreground cursor-pointer">
                {domainMode ? "Domain" : "General"}
              </Label>
              <Switch
                id="domain-mode"
                checked={domainMode}
                onCheckedChange={setDomainMode}
                className="scale-75"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {domainMode
              ? "Domain Mode: AI answers from your uploaded documents only"
              : "General Mode: AI answers from general knowledge"}
          </TooltipContent>
        </Tooltip>

        {/* Theme picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Palette className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {THEME_OPTIONS.map((t) => (
              <DropdownMenuItem
                key={t.name}
                onClick={() => setThemeName(t.name)}
                className={cn("gap-2", themeName === t.name && "bg-primary/10 text-primary")}
              >
                <span
                  className="h-3 w-3 rounded-full border border-border/50 shrink-0"
                  style={{ background: t.preview }}
                />
                {t.label}
                {themeName === t.name && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
          {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </Button>
      </div>
    </header>
  );
}
