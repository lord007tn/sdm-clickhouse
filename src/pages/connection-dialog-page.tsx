import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  ConnectionDiagnostics,
  ConnectionInput,
  ConnectionProfile,
} from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const baseConnection: ConnectionInput = {
  name: "",
  host: "localhost",
  port: 8123,
  database: "default",
  username: "default",
  secure: false,
  tlsInsecureSkipVerify: false,
  caCertPath: "",
  sshTunnel: {
    enabled: false,
    host: "",
    port: 22,
    username: "",
    localPort: 8123,
  },
  timeoutMs: 30000,
  password: "",
};

function applyConnectionDefaults(input: ConnectionInput): ConnectionInput {
  return {
    ...input,
    host: input.host.trim() || "localhost",
    port: input.port || 8123,
    database: input.database.trim() || "default",
    username: input.username.trim() || "default",
    timeoutMs: input.timeoutMs || 30000,
    caCertPath: (input.caCertPath ?? "").trim(),
    sshTunnel: input.sshTunnel?.enabled
      ? {
          enabled: true,
          host: input.sshTunnel.host ?? "",
          port: input.sshTunnel.port ?? 22,
          username: input.sshTunnel.username ?? "",
          localPort: input.sshTunnel.localPort ?? 8123,
        }
      : {
          enabled: false,
          host: "",
          port: 22,
          username: "",
          localPort: 8123,
        },
  };
}

type ConnectionDialogPageProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConnection: ConnectionProfile | null;
  connections: ConnectionProfile[];
  isTauriRuntime: boolean;
  onSaved: () => Promise<void>;
};

export function ConnectionDialogPage({
  open,
  onOpenChange,
  initialConnection,
  connections,
  isTauriRuntime,
  onSaved,
}: ConnectionDialogPageProps) {
  const [connectionDraft, setConnectionDraft] =
    useState<ConnectionInput>(baseConnection);
  const setConnectionDraftDeferred = (
    updater: React.SetStateAction<ConnectionInput>,
  ) => {
    window.setTimeout(() => setConnectionDraft(updater), 0);
  };
  const [showCaCertPath, setShowCaCertPath] = useState(false);
  const [showSshTunnel, setShowSshTunnel] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics | null>(
    null,
  );
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (initialConnection) {
      setConnectionDraft({
        id: initialConnection.id,
        name: initialConnection.name,
        host: initialConnection.host,
        port: initialConnection.port,
        database: initialConnection.database,
        username: initialConnection.username,
        secure: initialConnection.secure,
        tlsInsecureSkipVerify: initialConnection.tlsInsecureSkipVerify ?? false,
        caCertPath: initialConnection.caCertPath ?? "",
        sshTunnel: {
          enabled: false,
          ...initialConnection.sshTunnel,
        },
        timeoutMs: initialConnection.timeoutMs,
        password: "",
      });
      setShowCaCertPath(Boolean(initialConnection.caCertPath));
      setShowSshTunnel(Boolean(initialConnection.sshTunnel?.enabled));
    } else {
      setConnectionDraft({ ...baseConnection });
      setShowCaCertPath(false);
      setShowSshTunnel(false);
    }

    setDiagnostics(null);
  }, [initialConnection, open]);

  const handleDiagnose = async () => {
    if (!isTauriRuntime) return;
    setRunningDiagnostics(true);
    try {
      const draft = applyConnectionDefaults(connectionDraft);
      const result = await api.connectionDiagnostics(draft);
      setDiagnostics(result);
      if (result.ok) {
        toast.success("Diagnostics passed.");
      } else {
        toast.error(`Diagnostics failed (${result.category}).`);
      }
    } catch (error) {
      toast.error(String(error));
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const handleTestConnection = async () => {
    if (!isTauriRuntime) return;
    setTestingConnection(true);
    try {
      const draft = applyConnectionDefaults(connectionDraft);
      toast.success((await api.connectionTest(draft)).message);
    } catch (error) {
      toast.error(String(error));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!isTauriRuntime) return;

    const draft = applyConnectionDefaults(connectionDraft);
    const normalizedHost = draft.host.toLowerCase();
    const normalizedPort = draft.port || 8123;
    const normalizedDatabase = draft.database.toLowerCase();
    const normalizedUsername = draft.username.toLowerCase();
    const isDuplicate = connections.some(
      (c) =>
        c.id !== draft.id &&
        c.host.toLowerCase() === normalizedHost &&
        c.port === normalizedPort &&
        c.database.toLowerCase() === normalizedDatabase &&
        c.username.toLowerCase() === normalizedUsername,
    );
    if (isDuplicate) {
      toast.error(
        "A connection with the same host, port, database, and username already exists.",
      );
      return;
    }

    setSavingConnection(true);
    try {
      await api.connectionSave(draft);
      onOpenChange(false);
      toast.success("Connection saved.");
      await onSaved();
    } catch (error) {
      toast.error(String(error));
    } finally {
      setSavingConnection(false);
    }
  };

  const actionInProgress =
    runningDiagnostics || testingConnection || savingConnection;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {connectionDraft.id ? "Edit" : "New"} Connection
          </DialogTitle>
          <DialogDescription>
            Password is stored in your OS keychain when available. On Linux
            without keyring services, local fallback storage is used.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="connection-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Name
            </label>
            <Input
              id="connection-name"
              placeholder="My ClickHouse Server"
              value={connectionDraft.name}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setConnectionDraftDeferred((v) => ({ ...v, name: value }));
              }}
            />
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="connection-host"
                className="text-xs font-medium text-muted-foreground"
              >
                Host
              </label>
              <Input
                id="connection-host"
                placeholder="localhost"
                value={connectionDraft.host}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setConnectionDraftDeferred((v) => ({ ...v, host: value }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="connection-port"
                className="text-xs font-medium text-muted-foreground"
              >
                Port
              </label>
              <Input
                id="connection-port"
                type="number"
                value={connectionDraft.port}
                onChange={(e) => {
                  const value = Number(e.currentTarget.value) || 8123;
                  setConnectionDraftDeferred((v) => ({ ...v, port: value }));
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="connection-database"
              className="text-xs font-medium text-muted-foreground"
            >
              Database
            </label>
            <Input
              id="connection-database"
              placeholder="default"
              value={connectionDraft.database}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setConnectionDraftDeferred((v) => ({
                  ...v,
                  database: value,
                }));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="connection-username"
                className="text-xs font-medium text-muted-foreground"
              >
                Username
              </label>
              <Input
                id="connection-username"
                placeholder="default"
                value={connectionDraft.username}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setConnectionDraftDeferred((v) => ({
                    ...v,
                    username: value,
                  }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="connection-password"
                className="text-xs font-medium text-muted-foreground"
              >
                Password
              </label>
              <Input
                id="connection-password"
                type="password"
                placeholder="••••••"
                value={connectionDraft.password ?? ""}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setConnectionDraftDeferred((v) => ({
                    ...v,
                    password: value,
                  }));
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-md border border-border/60 px-3 py-2">
              <input
                id="secure-checkbox"
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-border accent-primary"
                checked={connectionDraft.secure}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setConnectionDraftDeferred((v) => ({
                    ...v,
                    secure: checked,
                  }));
                }}
              />
              <label
                htmlFor="secure-checkbox"
                className="text-xs text-foreground/80"
              >
                Use HTTPS
              </label>
            </div>
            <div className="flex items-center gap-2.5 rounded-md border border-border/60 px-3 py-2">
              <input
                id="tls-insecure-checkbox"
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-border accent-primary"
                checked={Boolean(connectionDraft.tlsInsecureSkipVerify)}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setConnectionDraftDeferred((v) => ({
                    ...v,
                    tlsInsecureSkipVerify: checked,
                  }));
                }}
              />
              <label
                htmlFor="tls-insecure-checkbox"
                className="text-xs text-foreground/80"
              >
                Skip TLS Verify
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="connection-timeout"
                className="text-xs font-medium text-muted-foreground"
              >
                Timeout (ms)
              </label>
              <Input
                id="connection-timeout"
                type="number"
                value={connectionDraft.timeoutMs ?? 30000}
                onChange={(e) => {
                  const value = Number(e.currentTarget.value) || 30000;
                  setConnectionDraftDeferred((v) => ({
                    ...v,
                    timeoutMs: value,
                  }));
                }}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full space-y-2 rounded-md border border-border/60 px-3 py-2">
                <label
                  htmlFor="connection-show-ca-cert"
                  className="flex items-center gap-2 text-xs text-foreground/80"
                >
                  <input
                    id="connection-show-ca-cert"
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                    checked={showCaCertPath}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setShowCaCertPath(checked);
                      if (!checked) {
                        setConnectionDraftDeferred((v) => ({
                          ...v,
                          caCertPath: "",
                        }));
                      }
                    }}
                  />
                  Use custom CA certificate
                </label>
                <label
                  htmlFor="connection-show-ssh-tunnel"
                  className="flex items-center gap-2 text-xs text-foreground/80"
                >
                  <input
                    id="connection-show-ssh-tunnel"
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                    checked={showSshTunnel}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setShowSshTunnel(checked);
                      if (!checked) {
                        setConnectionDraftDeferred((v) => ({
                          ...v,
                          sshTunnel: {
                            enabled: false,
                            host: "",
                            port: 22,
                            username: "",
                            localPort: 8123,
                          },
                        }));
                      } else {
                        setConnectionDraftDeferred((v) => ({
                          ...v,
                          sshTunnel: {
                            enabled: true,
                            host: v.sshTunnel?.host ?? "",
                            port: v.sshTunnel?.port ?? 22,
                            username: v.sshTunnel?.username ?? "",
                            localPort: v.sshTunnel?.localPort ?? 8123,
                          },
                        }));
                      }
                    }}
                  />
                  Use SSH tunnel metadata
                </label>
              </div>
            </div>
          </div>
          {showCaCertPath ? (
            <div className="space-y-1.5">
              <label
                htmlFor="connection-ca-cert-path"
                className="text-xs font-medium text-muted-foreground"
              >
                CA Cert Path
              </label>
              <Input
                id="connection-ca-cert-path"
                placeholder="/etc/ssl/certs/clickhouse-ca.pem"
                value={connectionDraft.caCertPath ?? ""}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setConnectionDraftDeferred((v) => ({
                    ...v,
                    caCertPath: value,
                  }));
                }}
              />
            </div>
          ) : null}
          {showSshTunnel ? (
            <div className="rounded-md border border-border/60 p-2">
              <div className="mb-2 text-[11px] font-medium text-muted-foreground">
                SSH Tunnel Profile (optional metadata)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="SSH Host"
                  value={connectionDraft.sshTunnel?.host ?? ""}
                  onChange={(e) => {
                    const host = e.currentTarget.value;
                    setConnectionDraftDeferred((v) => ({
                      ...v,
                      sshTunnel: {
                        ...(v.sshTunnel ?? {}),
                        enabled: true,
                        host,
                      },
                    }));
                  }}
                />
                <Input
                  placeholder="SSH Port"
                  type="number"
                  value={connectionDraft.sshTunnel?.port ?? 22}
                  onChange={(e) => {
                    const port = Number(e.currentTarget.value) || 22;
                    setConnectionDraftDeferred((v) => ({
                      ...v,
                      sshTunnel: {
                        ...(v.sshTunnel ?? {}),
                        enabled: true,
                        port,
                      },
                    }));
                  }}
                />
                <Input
                  placeholder="SSH Username"
                  value={connectionDraft.sshTunnel?.username ?? ""}
                  onChange={(e) => {
                    const username = e.currentTarget.value;
                    setConnectionDraftDeferred((v) => ({
                      ...v,
                      sshTunnel: {
                        ...(v.sshTunnel ?? {}),
                        enabled: true,
                        username,
                      },
                    }));
                  }}
                />
                <Input
                  placeholder="Local Port"
                  type="number"
                  value={connectionDraft.sshTunnel?.localPort ?? 8123}
                  onChange={(e) => {
                    const localPort = Number(e.currentTarget.value) || 8123;
                    setConnectionDraftDeferred((v) => ({
                      ...v,
                      sshTunnel: {
                        ...(v.sshTunnel ?? {}),
                        enabled: true,
                        localPort,
                      },
                    }));
                  }}
                />
              </div>
            </div>
          ) : null}
          {diagnostics ? (
            <div
              className={cn(
                "rounded-md border px-2 py-1.5 text-[11px]",
                diagnostics.ok
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-200",
              )}
            >
              <div className="font-medium">
                {diagnostics.ok ? "Diagnostics OK" : "Diagnostics failed"} (
                {diagnostics.category}) · {diagnostics.latencyMs}ms
              </div>
              <div className="truncate text-[10px]">
                {diagnostics.serverVersion
                  ? `version=${diagnostics.serverVersion}`
                  : diagnostics.detail}
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={!isTauriRuntime || actionInProgress}
            onClick={() => {
              window.setTimeout(() => {
                void handleDiagnose();
              }, 0);
            }}
          >
            {runningDiagnostics ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Diagnose
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!isTauriRuntime || actionInProgress}
            onClick={() => {
              window.setTimeout(() => {
                void handleTestConnection();
              }, 0);
            }}
          >
            {testingConnection ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Test Connection
          </Button>
          <Button
            size="sm"
            disabled={!isTauriRuntime || actionInProgress}
            onClick={() => {
              window.setTimeout(() => {
                void handleSaveConnection();
              }, 0);
            }}
          >
            {savingConnection ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

