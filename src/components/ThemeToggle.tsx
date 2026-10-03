import { Moon, Sun } from "lucide-react";
import { Button } from "@pacific-code-labs/sokol-design-system";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useLang } from "@/contexts/LangContext";
import { tChrome } from "@/lib/chrome-i18n";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { lang } = useLang();
  const chrome = tChrome(lang);
  return (
    <Button
      variant="outline"
      size="md"
      onClick={toggle}
      className={cn("relative h-10 w-10 px-0", className)}
      aria-label={theme === "dark" ? chrome.nav.themeToLight : chrome.nav.themeToDark}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-500 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-500 dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
