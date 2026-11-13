import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Domain, DnsChannel } from "../types/api";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Globe, MoreHorizontal, Plus, Power, PowerOff, RefreshCw, Search, UploadCloud, Trash, Play, Pencil, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { format } from "date-fns";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { useI18n } from "../components/LocaleProvider";
import { EmptyState, Page, TableSkeletonRows } from "../components/Page";
import { StatusBadge } from "../components/StatusBadge";
import { ExpiryMeter } from "../components/ExpiryMeter";
import { copyText } from "../lib/clipboard";
import { expiryTone } from "../lib/status";
import { cn } from "../lib/utils";

type FormValues = {
  id?: string;
  domain: string;
  dnsChannelId: string;
  enabled: boolean;
};

export function Domains() {
  const queryClient = useQueryClient();
  const { t, formatRelative, statusLabel, jobTypeLabel } = useI18n();
  const formSchema = useMemo(() => z.object({
    id: z.string().optional(),
    domain: z.string()
      .min(1, t("validation.domainRequired"))
      .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, t("validation.invalidDomain")),
    dnsChannelId: z.string().min(1, t("validation.dnsChannelRequired")),
    enabled: z.boolean(),
  }), [t]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const { data: domains = [], isLoading, isError, refetch } = useQuery<Domain[]>({
    queryKey: ['domains'],
    queryFn: () => api.get<Domain[]>('/admin/domains'),
  });

  const { data: channels = [] } = useQuery<DnsChannel[]>({
    queryKey: ['dns-channels'],
    queryFn: () => api.get<DnsChannel[]>('/admin/dns-channels'),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { domain: "", dnsChannelId: "", enabled: true },
  });

  const saveMutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (data.id) return api.patch(`/admin/domains/${data.id}`, data);
      return api.post('/admin/domains', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setIsAddOpen(false);
      form.reset({ domain: "", dnsChannelId: "", enabled: true });
      toast.success(t("domains.saved"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("domains.saveFailed"))
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string, enabled: boolean }) => api.patch(`/admin/domains/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success(t("domains.statusUpdated"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("domains.updateFailed"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/domains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setDeleteId(null);
      toast.success(t("domains.deleted"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("domains.deleteFailed"))
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string, action: 'issue' | 'renew' | 'sync' }) => api.post(`/admin/domains/${id}/${action}`),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(t("domains.startedAction", { action: jobTypeLabel(action) }));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("domains.actionFailed"))
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: 'issue' | 'renew' | 'sync' | 'enable' | 'disable' | 'delete' }) => {
      if (action === 'issue' || action === 'renew' || action === 'sync') {
        await api.post('/admin/domains/bulk-action', { ids, action });
        return;
      }
      for (const id of ids) {
        if (action === 'enable' || action === 'disable') {
          await api.patch(`/admin/domains/${id}`, { enabled: action === 'enable' });
          continue;
        }
        if (action === 'delete') {
          await api.delete(`/admin/domains/${id}`);
          continue;
        }
        await api.post(`/admin/domains/${id}/${action}`);
      }
    },
    onSuccess: (_, { action, ids }) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      if (action === 'enable' || action === 'disable') {
        toast.success(t("domains.bulkStatusUpdated", { count: ids.length }));
      } else if (action === 'delete') {
        toast.success(t("domains.bulkDeleted", { count: ids.length }));
      } else {
        toast.success(t("domains.bulkStartedAction", { count: ids.length, action: jobTypeLabel(action) }));
      }
    },
    onError: (err: unknown, { action }) => {
      if (action === 'delete') {
        toast.error((err as Error).message || t("domains.bulkDeleteFailed"));
      } else {
        toast.error((err as Error).message || t("domains.bulkActionFailed"));
      }
    }
  });

  const filteredDomains = useMemo(() => {
    return domains.filter((domain) => {
      const matchesStatus = (() => {
        if (statusFilter === "all") return true;
        if (statusFilter === "healthy") return domain.enabled && domain.status === "active";
        if (statusFilter === "attention") return !domain.enabled || domain.status !== "active";
        if (statusFilter === "disabled") return !domain.enabled;
        return domain.enabled && domain.status === statusFilter;
      })();

      const matchesChannel = channelFilter === "all" || domain.dnsChannelId === channelFilter;
      const matchesSearch = searchTerm.trim() === ""
        || domain.domain.toLowerCase().includes(searchTerm.trim().toLowerCase());
      return matchesStatus && matchesChannel && matchesSearch;
    });
  }, [channelFilter, domains, searchTerm, statusFilter]);

  const statusFilterLabel = useMemo(() => {
    switch (statusFilter) {
      case "all":
        return t("domains.filterAllStatuses");
      case "healthy":
        return t("domains.filterHealthy");
      case "attention":
        return t("domains.filterAttention");
      case "disabled":
        return t("common.disabled");
      case "active":
      case "expiring":
      case "pending":
      case "error":
        return statusLabel(statusFilter);
      default:
        return t("domains.filterAllStatuses");
    }
  }, [statusFilter, statusLabel, t]);

  const channelFilterLabel = useMemo(() => {
    if (channelFilter === "all") {
      return t("domains.filterAllChannels");
    }

    return channels.find((channel) => channel.id === channelFilter)?.name ?? t("domains.filterAllChannels");
  }, [channelFilter, channels, t]);

  const effectiveSelectedIds = useMemo(
    () => selectedIds.filter((id) => filteredDomains.some((domain) => domain.id === id)),
    [filteredDomains, selectedIds]
  );

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    const total = filteredDomains.length;
    const selected = effectiveSelectedIds.length;
    selectAllRef.current.indeterminate = selected > 0 && selected < total;
  }, [filteredDomains.length, effectiveSelectedIds]);

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  const openEdit = (d: Domain) => {
    form.reset({
      id: d.id,
      domain: d.domain,
      dnsChannelId: d.dnsChannelId,
      enabled: d.enabled
    });
    setIsAddOpen(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await copyText(text);
      toast.success(t("domains.shaCopied"));
    } catch {
      toast.error(t("nodes.copyFailed"));
    }
  };

  const editingId = useWatch({ control: form.control, name: "id" });
  const formChannelId = useWatch({ control: form.control, name: "dnsChannelId" });
  const formChannel = channels.find((channel) => channel.id === formChannelId);

  const openAdd = () => {
    form.reset({ id: undefined, domain: "", dnsChannelId: "", enabled: true });
    setIsAddOpen(true);
  };

  const isAllSelected = filteredDomains.length > 0 && effectiveSelectedIds.length === filteredDomains.length;
  const hasSelection = effectiveSelectedIds.length > 0;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : filteredDomains.map((domain) => domain.id));
  };

  const runBulkAction = (action: 'issue' | 'renew' | 'sync' | 'enable' | 'disable') => {
    if (!effectiveSelectedIds.length) {
      return;
    }
    bulkActionMutation.mutate({ ids: effectiveSelectedIds, action });
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

  const bulkPending = bulkActionMutation.isPending;

  return (
    <Page
      title={t("domains.title")}
      description={t("domains.description")}
      actions={
        <Button onClick={openAdd}>
          <Plus /> {t("domains.add")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="domain-search"
            type="search"
            aria-label={t("domains.searchLabel")}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t("domains.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger id="domain-status-filter" aria-label={t("domains.statusFilter")} className="w-full sm:w-44">
            <SelectValue>{statusFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("domains.filterAllStatuses")}</SelectItem>
            <SelectItem value="healthy">{t("domains.filterHealthy")}</SelectItem>
            <SelectItem value="attention">{t("domains.filterAttention")}</SelectItem>
            <SelectItem value="active">{t("status.active")}</SelectItem>
            <SelectItem value="expiring">{t("status.expiring")}</SelectItem>
            <SelectItem value="pending">{t("status.pending")}</SelectItem>
            <SelectItem value="error">{t("status.error")}</SelectItem>
            <SelectItem value="disabled">{t("common.disabled")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value ?? "all")}>
          <SelectTrigger id="domain-channel-filter" aria-label={t("domains.channelFilter")} className="w-full sm:w-48">
            <SelectValue>{channelFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("domains.filterAllChannels")}</SelectItem>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {t("domains.filteredCount", { filtered: filteredDomains.length, total: domains.length })}
        </p>
      </div>

      <Card className="gap-0 py-0">
        {hasSelection ? (
          <div className="flex flex-col gap-2 border-b bg-primary/5 px-4 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200 sm:flex-row sm:items-center">
            <p className="text-sm font-medium">
              {t("domains.selectedCount", { count: effectiveSelectedIds.length })}
            </p>
            <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
              <Button variant="ghost" size="sm" disabled={bulkPending} onClick={() => runBulkAction('issue')}>
                <Play /> {t("domains.bulkIssue")}
              </Button>
              <Button variant="ghost" size="sm" disabled={bulkPending} onClick={() => runBulkAction('renew')}>
                <RefreshCw /> {t("domains.bulkRenew")}
              </Button>
              <Button variant="ghost" size="sm" disabled={bulkPending} onClick={() => runBulkAction('sync')}>
                <UploadCloud /> {t("domains.bulkSync")}
              </Button>
              <Button variant="ghost" size="sm" disabled={bulkPending} onClick={() => runBulkAction('enable')}>
                <Power /> {t("domains.bulkEnable")}
              </Button>
              <Button variant="ghost" size="sm" disabled={bulkPending} onClick={() => runBulkAction('disable')}>
                <PowerOff /> {t("domains.bulkDisable")}
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={bulkPending} onClick={() => setBulkDeleteOpen(true)}>
                <Trash /> {t("domains.bulkDelete")}
              </Button>
              <Button variant="ghost" size="icon-sm" title={t("domains.clearSelection")} onClick={() => setSelectedIds([])}>
                <X />
                <span className="sr-only">{t("domains.clearSelection")}</span>
              </Button>
            </div>
          </div>
        ) : null}
        <CardContent className="p-0">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44px]">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label={t("domains.selectAll")}
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={filteredDomains.length === 0}
                    className="block size-4"
                  />
                </TableHead>
                <TableHead>{t("table.domain")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead className="w-[200px]">{t("domains.expiresRemaining")}</TableHead>
                <TableHead>{t("table.dnsChannel")}</TableHead>
                <TableHead>SHA256</TableHead>
                <TableHead>{t("domains.lastIssue")}</TableHead>
                <TableHead>{t("domains.lastSync")}</TableHead>
                <TableHead className="w-[56px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows columns={9} />
              ) : isError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9}>
                    <EmptyState
                      title={t("common.loadFailed")}
                      action={<Button variant="outline" onClick={() => void refetch()}>{t("common.retry")}</Button>}
                    />
                  </TableCell>
                </TableRow>
              ) : filteredDomains.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9}>
                    {domains.length === 0 ? (
                      <EmptyState
                        icon={Globe}
                        title={t("domains.empty")}
                        action={<Button onClick={openAdd}><Plus /> {t("domains.add")}</Button>}
                      />
                    ) : (
                      <EmptyState icon={Search} title={t("domains.noFilteredResults")} />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDomains.map((d) => {
                  const selected = effectiveSelectedIds.includes(d.id);
                  const tone = expiryTone(d.daysRemaining);
                  return (
                  <TableRow key={d.id} data-state={selected ? "selected" : undefined} className="data-[state=selected]:bg-primary/5">
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={t("domains.selectOne", { domain: d.domain })}
                        checked={selected}
                        onChange={() => toggleSelected(d.id)}
                        className="block size-4"
                      />
                    </TableCell>
                    <TableCell className={cn("font-medium", !d.enabled && "text-muted-foreground")}>{d.domain}</TableCell>
                    <TableCell>
                      {!d.enabled
                        ? <StatusBadge status="disabled">{t("common.disabled")}</StatusBadge>
                        : <StatusBadge status={d.status}>{statusLabel(d.status)}</StatusBadge>}
                    </TableCell>
                    <TableCell>
                      {d.expiresAt ? (
                        <div className={cn("space-y-1.5", !d.enabled && "opacity-50")}>
                          <div className="flex items-baseline justify-between gap-3 text-xs">
                            <span className="tabular text-sm">{format(new Date(d.expiresAt), 'yyyy-MM-dd')}</span>
                            {d.daysRemaining !== null && (
                              <span className={cn(
                                "tabular",
                                tone === "danger" ? "font-medium text-destructive" : tone === "warning" ? "font-medium text-warning" : "text-muted-foreground"
                              )}>
                                {d.daysRemaining < 0 ? t("status.expired") : t("common.daysLeft", { days: d.daysRemaining })}
                              </span>
                            )}
                          </div>
                          <ExpiryMeter days={d.daysRemaining} className="h-1" />
                        </div>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {channels.find(c => c.id === d.dnsChannelId)?.name || d.dnsChannelId}
                    </TableCell>
                    <TableCell>
                      {renderSha(d.certSha256)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.lastIssuedAt ? formatRelative(d.lastIssuedAt) : t("common.never")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.lastSyncAt ? formatRelative(d.lastSyncAt) : t("common.never")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <span className="sr-only">{t("table.actions")}</span>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => actionMutation.mutate({ id: d.id, action: 'issue' })}>
                            <Play className="size-4" /> {t("domains.issue")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => actionMutation.mutate({ id: d.id, action: 'renew' })}>
                            <RefreshCw className="size-4" /> {t("domains.renew")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => actionMutation.mutate({ id: d.id, action: 'sync' })}>
                            <UploadCloud className="size-4" /> {t("domains.sync")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(d)}>
                            <Pencil className="size-4" /> {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: d.id, enabled: !d.enabled })}>
                            {d.enabled ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                            {d.enabled ? t("domains.disable") : t("domains.enable")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(d.id)}>
                            <Trash className="size-4" /> {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{editingId ? t("domains.editTitle") : t("domains.addTitle")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="domain">{t("domains.domainName")}</Label>
                <Input id="domain" placeholder={t("domains.domainPlaceholder")} {...form.register('domain')} />
                {form.formState.errors.domain && <p className="text-sm text-destructive">{form.formState.errors.domain.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dnsChannelId">{t("table.dnsChannel")}</Label>
                <Select value={formChannelId || null} onValueChange={(val) => val && form.setValue('dnsChannelId', val, { shouldValidate: true, shouldDirty: true })}>
                  <SelectTrigger id="dnsChannelId" className="w-full">
                    <SelectValue placeholder={t("domains.selectDns")}>
                      {formChannel ? `${formChannel.name} (${formChannel.provider})` : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.provider})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.dnsChannelId && <p className="text-sm text-destructive">{form.formState.errors.dnsChannelId.message}</p>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="enabled" {...form.register('enabled')} className="size-4" />
                <Label htmlFor="enabled">{t("domains.enableAuto")}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("domains.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("domains.deleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !open && !bulkActionMutation.isPending && setBulkDeleteOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("domains.bulkDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("domains.bulkDeleteDescription", { count: effectiveSelectedIds.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={bulkActionMutation.isPending}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => bulkActionMutation.mutate({ ids: effectiveSelectedIds, action: 'delete' })} disabled={bulkActionMutation.isPending || !hasSelection}>
                {bulkActionMutation.isPending ? t("common.deleting") : t("domains.bulkDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
