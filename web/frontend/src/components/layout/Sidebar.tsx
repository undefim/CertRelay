import { NavLink } from "react-router-dom";
import { LayoutDashboard, Globe, Server, ListTree, Activity, Settings, ShieldCheck, Sun, Moon, Languages, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "../LocaleProvider";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "../AuthProvider";
import { Button } from "../ui/button";

export const navigation = [
  { labelKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { labelKey: "nav.domains", href: "/domains", icon: Globe },
  { labelKey: "nav.nodes", href: "/nodes", icon: Server },
  { labelKey: "nav.dnsChannels", href: "/dns-channels", icon: ListTree },
  { labelKey: "nav.jobs", href: "/jobs", icon: Activity },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
] as const;

export function Brand({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-center gap-2.5 text-[0.95rem] font-semibold tracking-tight", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <ShieldCheck className="size-[18px]" />
      </span>
      {t("app.name")}
    </div>
  );
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-0.5">
      {navigation.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
              "before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary before:transition-transform before:duration-200",
              isActive
                ? "bg-primary/10 text-primary before:scale-y-100"
                : "text-muted-foreground before:scale-y-0 hover:bg-muted hover:text-foreground"
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}

/** Theme, language and sign-out: the things that apply to the whole console. */
export function SessionControls() {
  const { t, language, setLanguage } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const { logout } = useAuth();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        title={t("topbar.toggleTheme")}
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="size-[1.1rem] scale-100 rotate-0 transition-transform duration-300 dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-[1.1rem] scale-0 rotate-90 transition-transform duration-300 dark:scale-100 dark:rotate-0" />
        <span className="sr-only">{t("topbar.toggleTheme")}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title={language === "zh-CN" ? "English" : "简体中文"}
        onClick={() => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN")}
      >
        <Languages className="size-[1.1rem]" />
        <span className="sr-only">{t("settings.language")}</span>
      </Button>
      <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={logout}>
        <LogOut className="size-4" />
        {t("topbar.logout")}
      </Button>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center px-5">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <NavList />
      </div>
      <div className="border-t border-border p-3">
        <SessionControls />
      </div>
    </aside>
  );
}
