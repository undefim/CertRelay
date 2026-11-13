import { Suspense, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth } from "../AuthProvider";

export function Layout() {
  const { token } = useAuth();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Each page starts at the top instead of inheriting the previous page's scroll position.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main ref={mainRef} className="flex-1 overflow-x-hidden overflow-y-auto">
          <div key={pathname} className="page-enter">
            <Suspense fallback={<div className="flex h-64 items-center justify-center" role="status"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
