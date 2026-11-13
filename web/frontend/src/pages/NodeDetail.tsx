import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { NodeDetailResponse, Domain, Settings as SettingsType } from "../types/api";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { ArrowLeft, Play, Pencil, Activity, Download, Trash2, TerminalSquare, Copy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { useForm, useWatch } from "react-hook-form";
import { useI18n } from "../components/LocaleProvider";
import { EmptyState } from "../components/Page";
import { StatusBadge } from "../components/StatusBadge";
import { Skeleton } from "../components/ui/skeleton";
import { copyText } from "../lib/clipboard";

export function NodeDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { t, formatRelative, statusLabel } = useI18n();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeployCodeOpen, setIsDeployCodeOpen] = useState(false);
  const [migrationToken, setMigrationToken] = useState<string | null>(null);
  const [pendingDeleteSelection, setPendingDeleteSelection] = useState<{ domainIds: string[]; domainNames: string[] } | null>(null);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const { data: node, isLoading } = useQuery<NodeDetailResponse>({
    queryKey: ['nodes', id],
    queryFn: () => api.get<NodeDetailResponse>(`/admin/nodes/${id}`),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const { data: domains = [] } = useQuery<Domain[]>({
    queryKey: ['domains'],
    queryFn: () => api.get<Domain[]>('/admin/domains'),
  });

  const { data: settings } = useQuery<SettingsType>({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsType>('/admin/settings'),
  });

  const allAssignedDomainIds = useMemo(
    () => (node?.assignments ?? []).map((assignment) => assignment.domainId),
    [node?.assignments],
  );
  const effectiveSelectedDomainIds = useMemo(
    () => selectedDomainIds.filter((domainId) => allAssignedDomainIds.includes(domainId)),
    [allAssignedDomainIds, selectedDomainIds],
  );
  const hasSelection = effectiveSelectedDomainIds.length > 0;
  const allSelected = allAssignedDomainIds.length > 0 && effectiveSelectedDomainIds.length === allAssignedDomainIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasSelection && !allSelected;
    }
  }, [allSelected, hasSelection]);

  const runNowMutation = useMutation({
    mutationFn: () => api.post(`/admin/nodes/${id}/run-now`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(t("nodeDetail.startedJob"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodeDetail.runFailed"))
  });

  const deployAssignmentMutation = useMutation({
    mutationFn: (domainIds: string[]) => api.post(`/admin/nodes/${id}/deploy`, { domainIds }),
    onSuccess: (_result, domainIds) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setSelectedDomainIds((current) => current.filter((domainId) => !domainIds.includes(domainId)));
      toast.success(
        domainIds.length > 1
          ? t("nodeDetail.bulkDeployQueued", { count: domainIds.length })
          : t("nodeDetail.deployQueued")
      );
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodeDetail.deployFailed"))
  });

  const deleteCertMutation = useMutation({
    mutationFn: (domainIds: string[]) => api.post(`/admin/nodes/${id}/delete-certs`, { domainIds }),
    onSuccess: (_result, domainIds) => {
      queryClient.invalidateQueries({ queryKey: ['nodes', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setPendingDeleteSelection(null);
      setSelectedDomainIds((current) => current.filter((domainId) => !domainIds.includes(domainId)));
      toast.success(
        domainIds.length > 1
          ? t("nodeDetail.bulkDeleteQueued", { count: domainIds.length })
          : t("nodeDetail.deleteQueued")
      );
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodeDetail.deleteFailed"))
  });

  const assignmentMutation = useMutation({
    mutationFn: (domainIds: string[]) => api.put(`/admin/nodes/${id}/assignments`, { domainIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes', id] });
      setIsEditOpen(false);
      toast.success(t("nodeDetail.assignmentsUpdated"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodeDetail.assignmentsFailed"))
  });

  const rotateTokenMutation = useMutation({
    mutationFn: () => api.post<{ token: string }>(`/admin/nodes/${id}/rotate-token`),
    onSuccess: (result) => {
      setMigrationToken(result.token);
      toast.success(t("nodeDetail.migrationTokenRotated"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodeDetail.migrationCodeFailed"))
  });

  const form = useForm<{ domainIds: string[] }>({
    defaultValues: { domainIds: [] }
  });
  const editSelectedDomainIds = useWatch({
    control: form.control,
    name: "domainIds",
  }) ?? [];
  const allEditDomainsSelected = domains.length > 0 && editSelectedDomainIds.length === domains.length;

  const openEdit = () => {
    form.reset({
      domainIds: node?.assignments.map(a => a.domainId) || []
    });
    setIsEditOpen(true);
  };

  const onSubmit = (values: { domainIds: string[] }) => {
    assignmentMutation.mutate(values.domainIds);
  };

  const toggleEditSelectAll = () => {
    form.setValue(
      "domainIds",
      allEditDomainsSelected ? [] : domains.map((domain) => domain.id),
      { shouldDirty: true }
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1360px] space-y-5 px-4 py-5 sm:px-8 sm:py-7" role="status" aria-label={t("nodeDetail.loading")}>
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-5 md:grid-cols-3">
          <Skeleton className="h-44 rounded-xl md:col-span-2" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (!node) {
    return (
      <div className="mx-auto w-full max-w-[1360px] px-4 py-5 sm:px-8 sm:py-7">
        <Card>
          <EmptyState
            title={t("nodeDetail.notFound")}
            action={<Button variant="outline" render={<Link to="/nodes" />}><ArrowLeft /> {t("nav.nodes")}</Button>}
          />
        </Card>
      </div>
    );
  }

  const openDeleteDialog = (domainIds: string[]) => {
    const selectedAssignments = node.assignments.filter((assignment) => domainIds.includes(assignment.domainId));
    setPendingDeleteSelection({
      domainIds,
      domainNames: selectedAssignments.map((assignment) => assignment.domainName || assignment.domainId),
    });
  };

  const toggleDomainSelection = (domainId: string, checked: boolean) => {
    setSelectedDomainIds((current) => {
      if (checked) {
        return current.includes(domainId) ? current : [...current, domainId];
      }
      return current.filter((item) => item !== domainId);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedDomainIds(checked ? allAssignedDomainIds : []);
  };

  const copyToClipboard = async (text: string, successMessage?: string) => {
    try {
      await copyText(text);
      toast.success(successMessage || t("domains.shaCopied"));
    } catch {
      toast.error(t("nodes.copyFailed"));
    }
  };

  const shellQuote = (value: string) => `'${value.split("'").join(`'"'"'`)}'`;
  const configuredPublicUrl = settings?.node.publicBaseUrl?.trim().replace(/\/+$/, "");
  const publicBaseUrl = configuredPublicUrl || window.location.origin.replace(/\/+$/, "");
  const manualUpdateCommand = [
    "sudo bash -c '",
    "  source /etc/default/cert-node",
    '  MASTER="${MASTER_URL%/}"',
    '  curl -fsSL "${MASTER}/api/agent.sh" | bash -s -- \\',
    '    --token "${NODE_TOKEN}" \\',
    '    --master-url "${MASTER}" \\',
    '    --cert-dir "${CERT_BASE_DIR:-/etc/nginx/ssl}" \\',
    '    --preserve-config',
    "'",
  ].join("\n");
  const migrationCommand = migrationToken
    ? [
        `curl -fsSL ${publicBaseUrl}/api/agent.sh | sudo bash -s -- \\`,
        `  --token ${shellQuote(migrationToken)} \\`,
        `  --master-url ${shellQuote(publicBaseUrl)} \\`,
        `  --cert-dir ${shellQuote(node.certDir)}`,
      ].join("\n")
    : "";

  const generateMigrationCode = () => {
    if (window.confirm(t("nodeDetail.rotateTokenWarning"))) {
      rotateTokenMutation.mutate();
    }
  };

  const renderSha = (sha: string | null) => {
    if (!sha) return <span className="text-muted-foreground">-</span>;
    return (
      <Tooltip>
        <TooltipTrigger
          className="rounded font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => void copyToClipboard(sha)}
        >
          {sha.substring(0, 12)}…
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs">{sha}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-5 px-4 py-5 sm:px-8 sm:py-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link to="/nodes" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-3.5" /> {t("nav.nodes")}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h1 className="text-[1.375rem] leading-tight font-semibold tracking-tight">{node.name}</h1>
            <StatusBadge status={node.isOnline ? "online" : "offline"} live={node.isOnline}>
              {node.isOnline ? t("status.online") : t("status.offline")}
            </StatusBadge>
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{node.ip || t("nodes.waitingHeartbeat")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={() => setIsDeployCodeOpen(true)}>
            <TerminalSquare /> {t("nodeDetail.deployCode")}
          </Button>
          <Button onClick={() => runNowMutation.mutate()} disabled={runNowMutation.isPending || !node.isOnline}>
            <Play /> {t("nodeDetail.runNow")}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t("nodeDetail.basicInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">{t("nodeDetail.targetDirectory")}</p>
                <p className="font-mono">{node.certDir}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">{t("table.lastHeartbeat")}</p>
                <p>{node.lastHeartbeatAt ? formatRelative(node.lastHeartbeatAt) : t("common.never")}</p>
              </div>
              {!node.isOnline && (
                <div>
                  <p className="text-muted-foreground mb-1">{t("nodeDetail.offlineAt")}</p>
                  <p>{node.offlineAt ? formatRelative(node.offlineAt) : t("common.never")}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-muted-foreground mb-1">{t("nodeDetail.latestError")}</p>
                {node.lastError ? (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 font-mono text-xs break-words text-destructive">{node.lastError}</p>
                ) : (
                  <p className="text-muted-foreground">{t("common.none")}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> {t("nodeDetail.recentEvents")}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[200px] overflow-y-auto">
            {node.recentEvents?.length > 0 ? (
              <div className="space-y-4">
                {node.recentEvents.map(e => (
                  <div key={e.id} className="border-l-2 border-border pb-1 pl-3 text-sm">
                    <p className="leading-snug">{e.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{format(new Date(e.createdAt), 'MM-dd HH:mm:ss')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("nodeDetail.noRecentEvents")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle>{t("nodeDetail.assignedDomains")}</CardTitle>
            <CardDescription>{t("nodeDetail.assignedDescription")}</CardDescription>
          </div>
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {hasSelection && (
              <>
                <div className="flex items-center px-1 text-sm text-muted-foreground">
                  {t("nodeDetail.selectedCount", { count: effectiveSelectedDomainIds.length })}
                </div>
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  size="sm"
                  onClick={() => deployAssignmentMutation.mutate(effectiveSelectedDomainIds)}
                  disabled={deployAssignmentMutation.isPending}
                >
                  <Download className="size-4" /> {t("nodeDetail.bulkDeploy")}
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  size="sm"
                  onClick={() => openDeleteDialog(effectiveSelectedDomainIds)}
                  disabled={deleteCertMutation.isPending}
                >
                  <Trash2 className="size-4" /> {t("nodeDetail.bulkDelete")}
                </Button>
                <Button className="w-full sm:w-auto" variant="ghost" size="sm" onClick={() => setSelectedDomainIds([])}>
                  {t("nodeDetail.clearSelection")}
                </Button>
              </>
            )}
            <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="size-4" /> {t("nodeDetail.editAssignments")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="border-t p-0">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[52px]">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="block size-4"
                    checked={allSelected}
                    aria-label={t("nodeDetail.selectAllAssignments")}
                    onChange={(event) => toggleSelectAll(event.target.checked)}
                  />
                </TableHead>
                <TableHead>{t("table.domain")}</TableHead>
                <TableHead>{t("nodeDetail.desiredSha")}</TableHead>
                <TableHead>{t("nodeDetail.deployedSha")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("nodeDetail.lastDeploy")}</TableHead>
                <TableHead className="w-[180px] text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {node.assignments?.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <EmptyState
                      title={t("nodeDetail.noAssignments")}
                      action={<Button variant="outline" onClick={openEdit}><Pencil /> {t("nodeDetail.editAssignments")}</Button>}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                node.assignments?.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="block size-4"
                        checked={effectiveSelectedDomainIds.includes(a.domainId)}
                        aria-label={t("nodeDetail.selectAssignment", { domain: a.domainName || a.domainId })}
                        onChange={(event) => toggleDomainSelection(a.domainId, event.target.checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{a.domainName || a.domainId}</TableCell>
                    <TableCell>{renderSha(a.desiredSha256)}</TableCell>
                    <TableCell>{renderSha(a.deployedSha256)}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status}>{statusLabel(a.status)}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {a.lastDeployAt ? formatRelative(a.lastDeployAt) : t("common.never")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deployAssignmentMutation.mutate([a.domainId])}
                          disabled={deployAssignmentMutation.isPending}
                        >
                          <Download className="size-4" /> {t("nodeDetail.deploy")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => openDeleteDialog([a.domainId])}
                          disabled={deleteCertMutation.isPending}
                        >
                          <Trash2 className="size-4" /> {t("nodeDetail.deleteCert")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{t("nodeDetail.editAssignments")}</DialogTitle>
              <DialogDescription>{t("nodeDetail.selectDomains", { node: node.name })}</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[300px] overflow-y-auto">
              {domains.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("nodeDetail.noAvailableDomains")}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {t("nodeDetail.selectedCount", { count: editSelectedDomainIds.length })}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleEditSelectAll}
                    >
                      {allEditDomainsSelected ? t("nodeDetail.clearSelection") : t("nodeDetail.selectAllDomains")}
                    </Button>
                  </div>
                  {domains.map(d => (
                    <div key={d.id} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id={`domain-${d.id}`}
                        value={d.id}
                        {...form.register('domainIds')}
                        className="block size-4"
                      />
                      <label htmlFor={`domain-${d.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                        {d.domain}
                      </label>
                    </div>
                  ))}
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={assignmentMutation.isPending}>
                {assignmentMutation.isPending ? t("common.saving") : t("nodeDetail.saveAssignments")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeployCodeOpen} onOpenChange={(open) => {
        setIsDeployCodeOpen(open);
        if (!open) setMigrationToken(null);
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("nodeDetail.deployCodeTitle")}</DialogTitle>
            <DialogDescription>{t("nodeDetail.deployCodeDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <h3 className="font-medium">{t("nodeDetail.manualUpdateTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("nodeDetail.manualUpdateDescription")}</p>
              </div>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-5 whitespace-pre-wrap break-all">{manualUpdateCommand}</pre>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(manualUpdateCommand, t("nodeDetail.commandCopied"))}>
                <Copy className="size-4" /> {t("nodeDetail.copyCommand")}
              </Button>
            </div>

            <div className="rounded-lg border border-destructive/40 p-4 space-y-3">
              <div>
                <h3 className="font-medium">{t("nodeDetail.migrationTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("nodeDetail.migrationDescription")}</p>
              </div>
              {migrationCommand ? (
                <>
                  <p className="text-sm text-destructive">{t("nodeDetail.migrationSecretWarning")}</p>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-5 whitespace-pre-wrap break-all">{migrationCommand}</pre>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(migrationCommand, t("nodeDetail.commandCopied"))}>
                    <Copy className="size-4" /> {t("nodeDetail.copyCommand")}
                  </Button>
                </>
              ) : (
                <Button variant="destructive" onClick={generateMigrationCode} disabled={rotateTokenMutation.isPending}>
                  {rotateTokenMutation.isPending ? t("nodeDetail.generatingMigrationCode") : t("nodeDetail.generateMigrationCode")}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDeleteSelection} onOpenChange={(open) => !open && setPendingDeleteSelection(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendingDeleteSelection && pendingDeleteSelection.domainIds.length > 1
                ? t("nodeDetail.deleteCertsTitle")
                : t("nodeDetail.deleteCertTitle")}
            </DialogTitle>
            <DialogDescription>
              {pendingDeleteSelection
                ? pendingDeleteSelection.domainIds.length > 1
                  ? t("nodeDetail.deleteCertDescriptionMany", { count: pendingDeleteSelection.domainIds.length })
                  : t("nodeDetail.deleteCertDescription", { domain: pendingDeleteSelection.domainNames[0] })
                : t("nodeDetail.deleteCertDescriptionFallback")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteSelection(null)} disabled={deleteCertMutation.isPending}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDeleteSelection && deleteCertMutation.mutate(pendingDeleteSelection.domainIds)}
              disabled={deleteCertMutation.isPending}
            >
              {deleteCertMutation.isPending
                ? t("common.deleting")
                : pendingDeleteSelection && pendingDeleteSelection.domainIds.length > 1
                  ? t("nodeDetail.deleteCertsConfirm")
                  : t("nodeDetail.deleteCertConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
