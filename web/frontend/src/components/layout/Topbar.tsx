import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { Brand, NavList, SessionControls } from "./Sidebar";
import { useI18n } from "../LocaleProvider";

/** Compact header for small screens; on desktop the sidebar carries everything. */
export function Topbar() {
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 lg:hidden">
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" />}>
          <Menu className="size-5" />
          <span className="sr-only">{t("topbar.toggleNav")}</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 max-w-[85vw] gap-0">
          <SheetHeader className="h-16 justify-center px-5">
            <SheetTitle render={<div />}>
              <Brand />
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <NavList onNavigate={() => setMobileMenuOpen(false)} />
          </div>
          <div className="border-t border-border p-3">
            <SessionControls />
          </div>
        </SheetContent>
      </Sheet>
      <Brand />
    </header>
  );
}
