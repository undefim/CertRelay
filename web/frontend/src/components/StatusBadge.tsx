import { cn } from "@/lib/utils";
import { toneForStatus, type Tone } from "@/lib/status";

const toneClass: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

/** A status pill: a coloured dot plus a label. `live` adds a soft pulse to the dot. */
export function StatusBadge({
  tone,
  status,
  live = false,
  className,
  children,
}: {
  tone?: Tone;
  status?: string;
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const resolved = tone ?? toneForStatus(status ?? "");
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        toneClass[resolved],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full bg-current", live && "dot-live")} aria-hidden="true" />
      {children}
    </span>
  );
}
