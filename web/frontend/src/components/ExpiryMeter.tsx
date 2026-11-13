import { cn } from "@/lib/utils";
import { expiryTone } from "@/lib/status";

/** Certificates here are issued for 90 days, so the bar spans one issuance. */
const CERT_LIFETIME_DAYS = 90;

const barClass = {
  success: "bg-success",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  info: "bg-primary",
  neutral: "bg-muted-foreground/40",
} as const;

/** How much of a certificate's validity is left, drawn as a bar that drains toward expiry. */
export function ExpiryMeter({ days, className }: { days: number | null; className?: string }) {
  const tone = expiryTone(days);
  const ratio = days === null ? 0 : Math.max(0, Math.min(1, days / CERT_LIFETIME_DAYS));
  // Keep a sliver visible so a nearly expired certificate still reads as a bar.
  const width = days === null ? 0 : Math.max(ratio * 100, 3);

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      aria-hidden="true"
    >
      <div className={cn("meter-fill h-full rounded-full", barClass[tone])} style={{ width: `${width}%` }} />
    </div>
  );
}
