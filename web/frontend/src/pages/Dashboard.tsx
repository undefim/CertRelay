import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Activity, ArrowRight, Globe, RefreshCw, Server, Timer } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { EmptyState, Page } from "../components/Page";
import { ExpiryMeter } from "../components/ExpiryMeter";
import { StatusBadge } from "../components/StatusBadge";
import { useI18n } from "../components/LocaleProvider";
import { api } from "../lib/api";
import { createEventStream } from "../lib/sse";
import { expiryTone, type Tone } from "../lib/status";
import { cn } from "../lib/utils";
import type { OverviewResponse, SystemEvent } from "../types/api";

const toneText: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-primary",
  neutral: "text-foreground",
};

const eventDot: Record<SystemEvent["level"], string> = {
  info: "bg-muted-foreground/50",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-destructive",
};

export function Dashboard() {
  const { t, formatRelative, statusLabel, eventTypeLabel } = useI18n();
  const { data: overview, isLoading, error, refetch, isFetching } = useQuery<OverviewResponse>({
    queryKey: ["overview"],
    queryFn: () => api.get("/admin/overview"),
    refetchInterval: 30000,
  });

  const [liveEvents, setLiveEvents] = useState<SystemEvent[]>([]);

  useEffect(() => {
    const es = createEventStream();
    es.onMessage((event) => {
      if (event.payload?.heartbeat) return;
      setLiveEvents((prev) => [event, ...prev].slice(0, 50));
    });
    return () => es.close();
  }, []);

  const refreshButton = (
    <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
      <RefreshCw className={cn(isFetching && "animate-spin")} />
      {t("common.refresh")}
    </Button>
  );

  if (isLoading) {
    return (
      <Page title={t("dashboard.title")} description={t("dashboard.description")}>
        <div className="space-y-5" role="status" aria-label={t("dashboard.loading")}>
          <Skeleton className="h-36 rounded-xl" />
          <div className="grid gap-5 lg:grid-cols-3">
            <Skeleton className="h-80 rounded-xl lg:col-span-2" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </Page>
    );
  }

  if (error || !overview) {
    return (
      <Page title={t("dashboard.title")} description={t("dashboard.description")}>
        <Card>
          <EmptyState
            title={t("dashboard.loadFailed")}
            hint={error instanceof Error ? error.message : undefined}
            action={<Button variant="outline" onClick={() => void refetch()}>{t("common.retry")}</Button>}
          />
        </Card>
      </Page>
    );
  }

  const { stats, certificates, nodes, automation } = overview;
  const liveIds = new Set(liveEvents.map((event) => event.id));
  const visibleEvents = [...new Map([...liveEvents, ...overview.recentEvents].map((event) => [event.id, event])).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
  const urgentCertificates = [...certificates]
    .sort((a, b) =>
      Number(b.status === "error") - Number(a.status === "error") || (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999))
    .slice(0, 6);

  const formatInterval = (seconds: number) => {
    if (seconds >= 3600 && seconds % 3600 === 0) return t("duration.hours", { n: seconds / 3600 });
    if (seconds >= 60 && seconds % 60 === 0) return t("duration.minutes", { n: seconds / 60 });
    return t("duration.seconds", { n: seconds });
  };

  const offlineNodes = stats.totalNodes - stats.onlineNodes;
  const tiles: Array<{ label: string; value: React.ReactNode; note?: string; tone: Tone; to: string }> = [
    {
      label: t("dashboard.onlineNodes"),
      value: <>{stats.onlineNodes}<span className="text-base font-normal text-muted-foreground"> / {stats.totalNodes}</span></>,
      tone: offlineNodes > 0 ? "danger" : "neutral",
      to: "/nodes",
    },
    { label: t("dashboard.totalDomains"), value: stats.totalDomains, tone: "neutral", to: "/domains" },
    {
      label: t("dashboard.expiringSoon"),
      value: stats.expiringSoon,
      note: t("dashboard.within7Days"),
      tone: stats.expiringSoon > 0 ? "warning" : "neutral",
      to: "/domains",
    },
    { label: t("dashboard.failedJobs"), value: stats.failedJobs, tone: stats.failedJobs > 0 ? "danger" : "neutral", to: "/jobs" },
  ];

  return (
    <Page title={t("dashboard.title")} description={t("dashboard.description")} actions={refreshButton}>
      <Card className="gap-0 py-0">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile, index) => (
            <Link
              key={tile.label}
              to={tile.to}
              className={cn(
                "group flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-muted/50",
                index % 2 === 1 && "border-l",
                index >= 2 && "border-t lg:border-t-0",
                index === 2 && "lg:border-l"
              )}
            >
              <span className="flex items-center justify-between text-sm text-muted-foreground">
                {tile.label}
                <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
              </span>
              <span className={cn("text-[1.75rem] leading-9 font-semibold tracking-tight", toneText[tile.tone])}>
                {tile.value}
              </span>
              <span className="h-4 text-xs text-muted-foreground">{tile.note}</span>
            </Link>
          ))}
        </div>
        {automation ? (
          <div className="flex flex-col gap-3 border-t bg-muted/30 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Timer className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <span className="font-medium">{t("dashboard.automation")}</span>
                <span className="ml-2 text-muted-foreground">
                  {t("dashboard.automationDetail", { interval: formatInterval(automation.checkIntervalSeconds), days: automation.renewDays })}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {automation.lastCheckAt
                    ? t("dashboard.lastCheck", { time: formatRelative(automation.lastCheckAt) })
                    : t("dashboard.waitingScheduler")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <StatusBadge tone={automation.pendingDeployments > 0 ? "warning" : "success"}>
                {automation.pendingDeployments > 0
                  ? t("dashboard.pendingDeployments", { count: automation.pendingDeployments })
                  : t("dashboard.allDeployed")}
              </StatusBadge>
              <Link to="/jobs" className="font-medium text-primary underline-offset-4 hover:underline">
                {t("dashboard.viewLogs")}
              </Link>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="gap-2">
            <CardHeader>
              <CardTitle>{t("dashboard.validity")}</CardTitle>
              <CardAction>
                <Link to="/domains" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {certificates.length === 0 ? (
                <EmptyState icon={Globe} title={t("dashboard.noDomains")} />
              ) : (
                <ul className="divide-y divide-border/70">
                  {urgentCertificates.map((cert) => {
                    const tone = cert.status === "error" ? "danger" : expiryTone(cert.daysRemaining);
                    return (
                      <li key={cert.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_7rem]">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{cert.domain}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {cert.expiresAt ? t("dashboard.expiresOn", { date: format(new Date(cert.expiresAt), "yyyy-MM-dd") }) : t("dashboard.notIssued")}
                          </p>
                        </div>
                        <ExpiryMeter days={cert.daysRemaining} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" />
                        <div className="justify-self-end text-right">
                          {cert.status === "error" || cert.daysRemaining === null ? (
                            <StatusBadge status={cert.status}>{statusLabel(cert.status)}</StatusBadge>
                          ) : (
                            <span className={cn("tabular text-sm font-medium", toneText[tone])}>
                              {cert.daysRemaining < 0 ? t("status.expired") : t("common.daysLeft", { days: cert.daysRemaining })}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader>
              <CardTitle>{t("dashboard.nodeHealth")}</CardTitle>
              <CardAction>
                <Link to="/nodes" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {nodes.length === 0 ? (
                <EmptyState icon={Server} title={t("dashboard.noNodes")} />
              ) : (
                <ul className="divide-y divide-border/70">
                  {nodes.slice(0, 6).map((node) => (
                    <li key={node.id}>
                      <Link to={`/nodes/${node.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{node.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{node.ip || t("nodes.waitingHeartbeat")}</p>
                        </div>
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {node.isOnline
                            ? (node.lastHeartbeatAt ? t("nodes.lastHeartbeatAt", { time: formatRelative(node.lastHeartbeatAt) }) : t("common.never"))
                            : (node.offlineAt ? t("nodes.offlineSince", { time: formatRelative(node.offlineAt) }) : t("common.never"))}
                        </span>
                        <StatusBadge status={node.isOnline ? "online" : "offline"} live={node.isOnline}>
                          {node.isOnline ? t("status.online") : t("status.offline")}
                        </StatusBadge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="gap-2 lg:sticky lg:top-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              {t("dashboard.liveEvents")}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[34rem] overflow-y-auto px-0">
            {visibleEvents.length === 0 ? (
              <EmptyState title={t("dashboard.waitingEvents")} />
            ) : (
              <ol className="px-5">
                {visibleEvents.map((evt) => (
                  <li
                    key={evt.id}
                    className={cn(
                      "relative -mx-2 rounded-md px-2 pb-4 pl-7 last:pb-1",
                      "before:absolute before:top-3 before:bottom-0 before:left-[0.9rem] before:w-px before:bg-border last:before:hidden",
                      liveIds.has(evt.id) && "event-enter"
                    )}
                  >
                    <span className={cn("absolute top-1.5 left-[0.7rem] size-[7px] rounded-full ring-4 ring-card", eventDot[evt.level])} aria-hidden="true" />
                    <p className="text-sm leading-snug break-words">{evt.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eventTypeLabel(evt.type)}
                      <span className="mx-1.5 text-border">|</span>
                      {formatRelative(evt.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
