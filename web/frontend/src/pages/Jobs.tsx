import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { Job } from "../types/api";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent } from "../components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Activity, ChevronRight, Copy, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useI18n } from "../components/LocaleProvider";
import { EmptyState, Page, TableSkeletonRows } from "../components/Page";
import { StatusBadge } from "../components/StatusBadge";
import { copyText } from "../lib/clipboard";
import { cn } from "../lib/utils";

const STATUS_OPTIONS = ["running", "pending", "success", "failed"] as const;
const TYPE_OPTIONS = ["issue", "renew", "sync", "deploy", "delete", "upgrade", "test_dns"] as const;

function formatDuration(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

export function Jobs() {
  const { t, statusLabel, jobTypeLabel } = useI18n();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: jobs = [], isLoading, isError, refetch, isFetching } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get<Job[]>('/admin/jobs'),
    refetchInterval: 10000,
  });

  const filteredJobs = jobs.filter(j => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (typeFilter !== 'all' && j.type !== typeFilter) return false;
    return true;
  });

  // Read the open job from the live list so its status keeps up with polling.
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  return (
    <Page
      title={t("jobs.title")}
      description={t("jobs.description")}
      actions={
        <>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || 'all')}>
            <SelectTrigger className="w-full sm:w-36" aria-label={t("table.status")}>
              <SelectValue>{statusFilter === "all" ? t("jobs.allStatuses") : statusLabel(statusFilter)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("jobs.allStatuses")}</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v || 'all')}>
            <SelectTrigger className="w-full sm:w-36" aria-label={t("table.type")}>
              <SelectValue>{typeFilter === "all" ? t("jobs.allTypes") : jobTypeLabel(typeFilter)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("jobs.allTypes")}</SelectItem>
              {TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>{jobTypeLabel(type)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn(isFetching && "animate-spin")} /> {t("common.refresh")}
          </Button>
        </>
      }
    >
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.type")}</TableHead>
                <TableHead>{t("table.target")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.started")}</TableHead>
                <TableHead>{t("table.duration")}</TableHead>
                <TableHead className="w-[48px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows columns={6} />
              ) : isError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <EmptyState
                      title={t("jobs.loadFailed")}
                      action={<Button variant="outline" onClick={() => void refetch()}>{t("common.retry")}</Button>}
                    />
                  </TableCell>
                </TableRow>
              ) : filteredJobs.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <EmptyState icon={jobs.length === 0 ? Activity : Search} title={t("jobs.empty")} />
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((j) => (
                  <TableRow
                    key={j.id}
                    tabIndex={0}
                    className="group cursor-pointer"
                    onClick={() => setSelectedJobId(j.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedJobId(j.id);
                      }
                    }}
                  >
                    <TableCell className="font-medium">{jobTypeLabel(j.type)}</TableCell>
                    <TableCell>{j.targetName || j.targetId}</TableCell>
                    <TableCell>
                      <StatusBadge status={j.status} live={j.status === 'running'}>{statusLabel(j.status)}</StatusBadge>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {j.startedAt ? format(new Date(j.startedAt), 'yyyy-MM-dd HH:mm:ss') : '-'}
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      {j.durationMs !== null ? formatDuration(j.durationMs) : '-'}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
                      <span className="sr-only">{t("common.view")}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <JobLogSheet job={selectedJob} onClose={() => setSelectedJobId(null)} />
    </Page>
  );
}

function JobLogSheet({ job, onClose }: { job: Job | null, onClose: () => void }) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const { t, jobTypeLabel, statusLabel } = useI18n();

  const { data: logData, isLoading } = useQuery<{ logs: string }>({
    queryKey: ['job-logs', job?.id],
    queryFn: () => api.get<{ logs: string }>(`/admin/jobs/${job?.id}/logs`),
    enabled: !!job,
    refetchInterval: job?.status === 'running' ? 2000 : false,
  });

  useEffect(() => {
    if (logData?.logs) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logData?.logs]);

  const copyLogs = async () => {
    if (!logData?.logs) {
      return;
    }

    try {
      await copyText(logData.logs);
      toast.success(t("jobs.logsCopied"));
    } catch {
      toast.error(t("jobs.logsCopyFailed"));
    }
  };

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 sm:max-w-2xl">
        <SheetHeader className="gap-1 border-b px-5 py-4 pr-14">
          <SheetTitle className="flex items-center gap-3">
            {t("jobs.logsTitle")}
            {job ? (
              <StatusBadge status={job.status} live={job.status === 'running'}>{statusLabel(job.status)}</StatusBadge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {job && t("jobs.sheetDescription", { type: jobTypeLabel(job.type), target: job.targetName || job.targetId })}
          </SheetDescription>
        </SheetHeader>

        {job?.error ? (
          <p className="border-b bg-destructive/10 px-5 py-2.5 text-sm break-words text-destructive">{job.error}</p>
        ) : null}

        <div className="relative m-4 min-h-0 flex-1 overflow-hidden rounded-lg bg-[#101614] text-[#c9d6cf]">
          {logData?.logs ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={copyLogs}
              className="absolute top-2 right-3 z-10 bg-white/10 text-[#e6efe9] backdrop-blur hover:bg-white/20 hover:text-white dark:hover:bg-white/20"
            >
              <Copy /> {t("jobs.copyLogs")}
            </Button>
          ) : null}
          <div className="h-full overflow-y-auto p-4 font-mono text-[13px]">
            {isLoading ? (
              <div className="text-[#7d8f86]">{t("jobs.loadingLogs")}</div>
            ) : (
              <pre className="leading-relaxed break-words whitespace-pre-wrap">
                {logData?.logs || (job?.status === 'running' ? t("jobs.waitingOutput") : t("jobs.noLogs"))}
              </pre>
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
