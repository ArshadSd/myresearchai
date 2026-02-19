import { useState } from "react";
import { Moon, Sun, Brain, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/contexts/ThemeContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const [domainMode, setDomainMode] = useState(false);

  // Store domain mode globally via window for chat to read
  (window as any).__domainMode = domainMode;

  return (
    <header className="h-14 border-b border-border/30 glass flex items-center justify-between px-6">
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
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
          {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </Button>
      </div>
    </header>
  );
}
