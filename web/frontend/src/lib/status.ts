export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const statusTone: Record<string, Tone> = {
  active: "success",
  synced: "success",
  success: "success",
  online: "success",
  expiring: "warning",
  pending: "neutral",
  running: "info",
  expired: "danger",
  error: "danger",
  failed: "danger",
  offline: "danger",
  disabled: "neutral",
};

export function toneForStatus(status: string): Tone {
  return statusTone[status] ?? "neutral";
}

/** Urgency of a certificate by days left: a week or less is critical, a month or less needs attention. */
export function expiryTone(days: number | null): Tone {
  if (days === null) return "neutral";
  if (days <= 7) return "danger";
  if (days <= 30) return "warning";
  return "success";
}
