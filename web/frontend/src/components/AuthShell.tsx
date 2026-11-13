import { CircleAlert, ShieldCheck } from "lucide-react";

/** Centered frame shared by the sign-in and first-run setup screens. */
export function AuthShell({
  title,
  description,
  error,
  children,
}: {
  title: string;
  description: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
      <div className="page-enter w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-card">
          {error ? (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
