import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { CertNode, Settings as SettingsType } from "../types/api";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Plus, Server, Trash, Copy, CheckCircle2, Globe, Folder, TerminalSquare, Pencil, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useI18n } from "../components/LocaleProvider";
import { EmptyState, Page, TableSkeletonRows } from "../components/Page";
import { StatusBadge } from "../components/StatusBadge";
import { copyText } from "../lib/clipboard";

export function Nodes() {
  const queryClient = useQueryClient();
  const { t, formatRelative } = useI18n();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<CertNode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newNodeToken, setNewNodeToken] = useState<string | null>(null);
  const [newNodeCertDir, setNewNodeCertDir] = useState<string>("/etc/nginx/ssl");

  const { data: nodes = [], isLoading, isError, refetch } = useQuery<CertNode[]>({
    queryKey: ['nodes'],
    queryFn: () => api.get('/admin/nodes'),
    refetchInterval: 30000,
  });
  const { data: settings } = useQuery<SettingsType>({
    queryKey: ['settings'],
    queryFn: () => api.get('/admin/settings'),
  });

  const addForm = useForm({
    defaultValues: { name: "", certDir: "/etc/nginx/ssl" },
  });
  const renameForm = useForm({
    defaultValues: { name: "", ip: "", certDir: "/etc/nginx/ssl" },
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; certDir: string }) => api.post<{ token: string; certDir?: string }>('/admin/nodes', data),
    onSuccess: (data: { token: string; certDir?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      setNewNodeToken(data.token);
      setNewNodeCertDir(data.certDir || addForm.getValues("certDir") || "/etc/nginx/ssl");
      toast.success(t("nodes.added"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodes.addFailed"))
  });

  const renameMutation = useMutation({
    mutationFn: (data: { id: string; name: string; ip: string; certDir: string }) =>
      api.patch<CertNode>(`/admin/nodes/${data.id}`, {
        name: data.name,
        ip: data.ip,
        certDir: data.certDir,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      setEditingNode(null);
      renameForm.reset({ name: "", ip: "", certDir: "/etc/nginx/ssl" });
      toast.success(t("nodes.renamed"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodes.renameFailed"))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      setDeleteId(null);
      toast.success(t("nodes.deleted"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodes.deleteFailed"))
  });

  const upgradeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/nodes/${id}/upgrade-agent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(t("nodes.upgradeQueued"));
    },
    onError: (err: unknown) => toast.error((err as Error).message || t("nodes.upgradeFailed"))
  });

  const onSubmit = (values: { name: string; certDir: string }) => {
    createMutation.mutate({
      name: values.name.trim(),
      certDir: values.certDir.trim() || "/etc/nginx/ssl",
    });
  };

  const openRenameDialog = (node: CertNode) => {
    renameForm.reset({
      name: node.name,
      ip: node.ip || "",
      certDir: node.certDir || "/etc/nginx/ssl",
    });
    setEditingNode(node);
  };

  const onRenameSubmit = (values: { name: string; ip: string; certDir: string }) => {
    const name = values.name.trim();
    const certDir = values.certDir.trim();
    if (!name) {
      toast.error(t("nodes.nameRequired"));
      return;
    }
    if (!certDir) {
      toast.error(t("nodes.certDirRequired"));
      return;
    }
    if (!editingNode) {
      return;
    }
    renameMutation.mutate({
      id: editingNode.id,
      name,
      ip: values.ip.trim(),
      certDir,
    });
  };

  const shellQuote = (value: string) => `'${value.split("'").join(`'"'"'`)}'`;

  const resolvePublicBaseUrl = () => {
    const configured = settings?.node.publicBaseUrl?.trim().replace(/\/+$/, "");
    if (configured) {
      return configured;
    }

    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "/api";
    if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
      return apiBase.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    }

    return window.location.origin.replace(/\/+$/, "");
  };

  const publicBaseUrl = resolvePublicBaseUrl();
  const installCommand = newNodeToken
    ? `curl -fsSL ${publicBaseUrl}/api/agent.sh | bash -s -- --token ${shellQuote(newNodeToken)} --master-url ${shellQuote(publicBaseUrl)} --cert-dir ${shellQuote(newNodeCertDir)}`
    : "";
  const displayInstallCommand = newNodeToken
    ? [
        `curl -fsSL ${publicBaseUrl}/api/agent.sh | bash -s -- \\`,
        `  --token ${shellQuote(newNodeToken)} \\`,
        `  --master-url ${shellQuote(publicBaseUrl)} \\`,
        `  --cert-dir ${shellQuote(newNodeCertDir)}`,
      ].join("\n")
    : "";

  const copyToClipboard = async (text: string) => {
    try {
      await copyText(text);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("nodes.copyFailed"));
    }
  };

  return (
    <Page
      title={t("nodes.title")}
      description={t("nodes.description")}
      actions={
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus /> {t("nodes.add")}
        </Button>
      }
    >
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.agentVersion")}</TableHead>
                <TableHead>{t("table.certDirectory")}</TableHead>
                <TableHead>{t("table.assigned")}</TableHead>
                <TableHead className="w-[132px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows columns={6} />
              ) : isError ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <EmptyState
                      title={t("common.loadFailed")}
                      action={<Button variant="outline" onClick={() => void refetch()}>{t("common.retry")}</Button>}
                    />
                  </TableCell>
                </TableRow>
              ) : nodes.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={Server}
                      title={t("nodes.empty")}
                      action={<Button onClick={() => setIsAddOpen(true)}><Plus /> {t("nodes.add")}</Button>}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                nodes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <Link to={`/nodes/${n.id}`} className="font-medium underline-offset-4 hover:text-primary hover:underline">
                        {n.name}
                      </Link>
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {n.ip || t("nodes.waitingHeartbeat")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={n.isOnline ? "online" : "offline"} live={n.isOnline}>
                        {n.isOnline ? t("status.online") : t("status.offline")}
                      </StatusBadge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {n.isOnline
                          ? (n.lastHeartbeatAt
                              ? t("nodes.lastHeartbeatAt", { time: formatRelative(n.lastHeartbeatAt) })
                              : t("common.never"))
                          : (n.offlineAt
                              ? t("nodes.offlineSince", { time: formatRelative(n.offlineAt) })
                              : t("common.never"))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{n.agentVersion || t("nodes.versionUnknown")}</span>
                        {n.agentVersion && n.updateAvailable ? (
                          <StatusBadge tone="warning" className="h-5 px-2 text-[11px]">
                            {n.supportsSelfUpdate ? t("nodes.updateAvailable") : t("nodes.manualBootstrap")}
                          </StatusBadge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {n.agentVersion && !n.updateAvailable
                          ? t("nodes.latestVersion")
                          : t("nodes.latestVersionValue", { version: n.latestAgentVersion })}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{n.certDir}</TableCell>
                    <TableCell className="text-muted-foreground">{t("nodes.assignedDomains", { count: n.assignedDomainsCount })}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        {n.updateAvailable ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={n.supportsSelfUpdate ? t("nodes.upgrade") : t("nodes.manualBootstrapHint")}
                            disabled={!n.isOnline || !n.supportsSelfUpdate || (upgradeMutation.isPending && upgradeMutation.variables === n.id)}
                            onClick={() => upgradeMutation.mutate(n.id)}
                          >
                            <ArrowUpCircle className="text-primary" />
                            <span className="sr-only">{t("nodes.upgrade")}</span>
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon-sm" title={t("common.edit")} onClick={() => openRenameDialog(n)}>
                          <Pencil />
                          <span className="sr-only">{t("common.edit")}</span>
                        </Button>
                        <Button variant="ghost" size="icon-sm" title={t("common.delete")} className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(n.id)}>
                          <Trash />
                          <span className="sr-only">{t("common.delete")}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setNewNodeToken(null);
          setNewNodeCertDir("/etc/nginx/ssl");
          addForm.reset();
        }
      }}>
        <DialogContent className={newNodeToken
          ? "w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0"
          : "w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto p-0"}>
          {!newNodeToken ? (
            <form onSubmit={addForm.handleSubmit(onSubmit)} className="p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>{t("nodes.addTitle")}</DialogTitle>
                <DialogDescription>{t("nodes.addDescription")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("nodes.nodeName")}</Label>
                  <Input id="name" placeholder={t("nodes.nodePlaceholder")} required autoFocus {...addForm.register('name')} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="certDir">{t("table.certDirectory")}</Label>
                  <Input id="certDir" placeholder="/etc/nginx/ssl" required {...addForm.register('certDir')} />
                </div>
              </div>
              <DialogFooter className="-mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t("nodes.generatingToken") : t("nodes.register")}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <>
              <DialogHeader className="border-b px-4 py-5 pr-14 sm:px-6">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <DialogTitle className="text-xl">{t("nodes.registered")}</DialogTitle>
                    <DialogDescription className="max-w-2xl leading-7">
                      {t("nodes.commandDescription")}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-5 px-4 py-5 sm:px-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>{t("nodes.masterUrl")}</Label>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="font-mono text-sm leading-6 break-all">{publicBaseUrl}</div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("nodes.masterUrlHint")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("nodes.certDir")}</Label>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <Folder className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 font-mono text-sm leading-6 break-all">{newNodeCertDir}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border">
                  <div className="flex flex-col gap-3 border-b bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <TerminalSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">{t("nodes.installCommandTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("nodes.installCommandHint")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("nodes.runOnNode")}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto shrink-0"
                      onClick={() => copyToClipboard(installCommand)}
                    >
                      <Copy className="size-4" />
                      {t("common.copy")}
                    </Button>
                  </div>
                  <div className="bg-background px-4 py-4">
                    <pre className="overflow-x-auto font-mono text-sm leading-7 text-foreground">
                      <code>{displayInstallCommand}</code>
                    </pre>
                  </div>
                </div>
              </div>
              <div className="flex justify-end border-t bg-muted/30 px-4 py-4 sm:px-6">
                <Button onClick={() => setIsAddOpen(false)}>{t("nodes.done")}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingNode} onOpenChange={(open) => {
        if (!open) {
          setEditingNode(null);
          renameForm.reset({ name: "", ip: "", certDir: "/etc/nginx/ssl" });
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={renameForm.handleSubmit(onRenameSubmit)}>
            <DialogHeader>
              <DialogTitle>{t("nodes.renameTitle")}</DialogTitle>
              <DialogDescription>{t("nodes.renameDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rename-node-name">{t("nodes.nodeName")}</Label>
                <Input
                  id="rename-node-name"
                  placeholder={t("nodes.nodePlaceholder")}
                  required
                  autoFocus
                  {...renameForm.register('name')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rename-node-ip">{t("table.ipAddress")}</Label>
                <Input
                  id="rename-node-ip"
                  placeholder="192.168.1.10"
                  {...renameForm.register('ip')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rename-node-cert-dir">{t("table.certDirectory")}</Label>
                <Input
                  id="rename-node-cert-dir"
                  placeholder="/etc/nginx/ssl"
                  required
                  {...renameForm.register('certDir')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditingNode(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={renameMutation.isPending}>
                {renameMutation.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("nodes.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("nodes.deleteDescription")}
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
    </Page>
  );
}
