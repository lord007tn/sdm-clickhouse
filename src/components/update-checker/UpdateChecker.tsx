import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { UpdateDownloadProgress } from "@/types";
import { Progress } from "@/components/ui/progress";

type UpdateCheckerProps = {
  isTauriRuntime: boolean;
  appVersion: string;
};

type UpdaterState = {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloadReady: boolean;
  installing: boolean;
  version?: string;
  done: boolean;
  downloadProgress: number;
};

export function UpdateChecker({
  isTauriRuntime,
  appVersion,
}: UpdateCheckerProps) {
  const [updater, setUpdater] = useState<UpdaterState>({
    checking: false,
    available: false,
    downloading: false,
    downloadReady: false,
    installing: false,
    done: false,
    downloadProgress: 0,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkForUpdates = useCallback(
    async (manual: boolean) => {
      if (!isTauriRuntime) {
        if (manual) {
          toast.error("Updater is only available in Tauri runtime.");
        }
        return;
      }

      setUpdater((current) => ({
        ...current,
        checking: true,
        done: false,
      }));

      try {
        const update = await api.appCheckUpdate();
        if (!mountedRef.current) return;

        if (!update.available) {
          setUpdater((current) => ({
            ...current,
            checking: false,
            available: false,
            downloading: false,
            downloadReady: false,
            installing: false,
            version: undefined,
            downloadProgress: 0,
          }));
          if (manual) {
            toast.success("You're on the latest version.");
          }
          return;
        }

        setUpdater((current) => ({
          ...current,
          checking: false,
          available: true,
          downloading: false,
          downloadReady: update.downloaded ?? false,
          installing: false,
          version: update.latestVersion,
          downloadProgress: update.downloaded ? 100 : 0,
        }));

        if (manual) {
          toast.success(`Update v${update.latestVersion} available.`);
        }
      } catch (error) {
        if (!mountedRef.current) return;
        setUpdater((current) => ({
          ...current,
          checking: false,
        }));
        if (manual) {
          const msg = String(error);
          if (msg.includes("403") || msg.includes("rate limit")) {
            toast("Update check skipped — GitHub rate limit reached. Try again later.");
          } else {
            toast.error(`Update check failed: ${msg}`);
          }
        }
      }
    },
    [isTauriRuntime],
  );

  const handleManualUpdateCheck = useCallback(async () => {
    if (!isTauriRuntime) {
      toast.error("Updater is only available in Tauri runtime.");
      return;
    }
    await checkForUpdates(true);
  }, [checkForUpdates, isTauriRuntime]);

  const installUpdate = useCallback(async () => {
    if (!isTauriRuntime) return;

    setUpdater((current) => ({
      ...current,
      installing: true,
      done: false,
    }));

    try {
      const result = await api.appInstallUpdate();
      if (!mountedRef.current) return;
      setUpdater((current) => ({
        ...current,
        installing: false,
        done: true,
        available: false,
      }));
      toast.success(result.message);
    } catch (error) {
      if (!mountedRef.current) return;
      setUpdater((current) => ({
        ...current,
        installing: false,
      }));
      toast.error(`Update failed: ${String(error)}`);
    }
  }, [isTauriRuntime]);

  const downloadUpdate = useCallback(async () => {
    if (!isTauriRuntime) return;

    setUpdater((current) => ({
      ...current,
      available: true,
      downloading: true,
      downloadReady: false,
      installing: false,
      done: false,
      downloadProgress: Math.max(current.downloadProgress, 4),
    }));

    try {
      const result = await api.appDownloadUpdate();
      if (!mountedRef.current) return;
      setUpdater((current) => ({
        ...current,
        available: true,
        downloading: false,
        downloadReady: true,
        installing: false,
        version: result.version,
        downloadProgress: 100,
      }));
      toast.success(result.message);
    } catch (error) {
      if (!mountedRef.current) return;
      setUpdater((current) => ({
        ...current,
        downloading: false,
        downloadReady: false,
        downloadProgress: 0,
      }));
      toast.error(`Update download failed: ${String(error)}`);
    }
  }, [isTauriRuntime]);

  useEffect(() => {
    if (!isTauriRuntime) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      try {
        const cleanup = await listen("check-for-updates", () => {
          void checkForUpdates(true);
        });
        if (disposed) {
          cleanup();
          return;
        }
        unlisten = cleanup;
      } catch {
        // Keep checker functional even if event listener setup fails.
      }
    })();

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [checkForUpdates, isTauriRuntime]);

  useEffect(() => {
    if (!isTauriRuntime) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      try {
        const cleanup = await listen<UpdateDownloadProgress>(
          "update-download-progress",
          (event) => {
            if (disposed || !mountedRef.current) return;
            const payload = event.payload;
            setUpdater((current) => ({
              ...current,
              available: true,
              downloading: payload.status !== "ready",
              downloadReady: payload.status === "ready",
              version: payload.version ?? current.version,
              downloadProgress:
                payload.progressPercent ?? current.downloadProgress,
            }));
          },
        );
        if (disposed) {
          cleanup();
          return;
        }
        unlisten = cleanup;
      } catch {
        // Keep updater functional if progress events are unavailable.
      }
    })();

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [isTauriRuntime]);

  useEffect(() => {
    if (!updater.downloading) return;
    const timer = window.setInterval(() => {
      setUpdater((current) => {
        if (!current.downloading || current.downloadProgress >= 92) {
          return current;
        }
        const nextProgress =
          current.downloadProgress < 48
            ? current.downloadProgress + 8
            : current.downloadProgress + 3;
        return {
          ...current,
          downloadProgress: Math.min(nextProgress, 92),
        };
      });
    }, 280);
    return () => window.clearInterval(timer);
  }, [updater.downloading]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/50">
          v{appVersion}
        </span>
        {updater.done ? (
          <span className="text-[10px] font-medium text-primary">
            Installer launched
          </span>
        ) : updater.installing ? (
          <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Launching installer
          </span>
        ) : updater.available && updater.downloadReady ? (
          <button
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
            onClick={() => void installUpdate()}
            aria-label={`Install update version ${updater.version}`}
            title="Launch downloaded installer"
            data-testid="install-update-button"
          >
            <Download className="h-3 w-3" />
            Install v{updater.version}
          </button>
        ) : updater.available ? (
          <button
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
            onClick={() => void downloadUpdate()}
            aria-label={`Download update version ${updater.version}`}
            title="Download update"
            disabled={updater.downloading}
            data-testid="download-update-button"
          >
            {updater.downloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Update v{updater.version}
          </button>
        ) : (
          <button
            className="rounded-md p-0.5 text-muted-foreground/40 hover:text-muted-foreground"
            onClick={() => void handleManualUpdateCheck()}
            disabled={updater.checking}
            title="Check for updates"
            aria-label="Check for updates"
          >
            {updater.checking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      {updater.downloading ? (
        <div
          className="flex w-[118px] items-center gap-2"
          data-testid="update-download-progress"
        >
          <Progress
            className="w-full gap-0"
            value={Math.max(2, Math.min(updater.downloadProgress, 100))}
          />
          <span className="text-[9px] font-medium text-muted-foreground">
            {updater.downloadProgress >= 100 ? "Verifying" : "Downloading"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
