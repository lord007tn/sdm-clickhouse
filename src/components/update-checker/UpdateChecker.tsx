import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type UpdateCheckerProps = {
  isTauriRuntime: boolean;
  appVersion: string;
};

type UpdaterState = {
  checking: boolean;
  available: boolean;
  installing: boolean;
  version?: string;
  done: boolean;
};

export function UpdateChecker({
  isTauriRuntime,
  appVersion,
}: UpdateCheckerProps) {
  const [updater, setUpdater] = useState<UpdaterState>({
    checking: false,
    available: false,
    installing: false,
    done: false,
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
            installing: false,
            version: undefined,
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
          installing: false,
          version: update.latestVersion,
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
          toast.error(`Update check failed: ${String(error)}`);
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

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground/50">
        v{appVersion}
      </span>
      {updater.done ? (
        <span className="text-[10px] font-medium text-emerald-400">
          Installer launched
        </span>
      ) : updater.installing ? (
        <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          Launching installer
        </span>
      ) : updater.available ? (
        <button
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
          onClick={() => void installUpdate()}
          aria-label={`Install update version ${updater.version}`}
          title="Download and launch installer"
          data-testid="install-update-button"
        >
          <Download className="h-3 w-3" />v{updater.version}
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
  );
}
