import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
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
  downloading: boolean;
  progress: number;
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
    downloading: false,
    progress: 0,
    done: false,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
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
        const update = await check();
        if (!mountedRef.current) return;

        if (!update) {
          setUpdater((current) => ({
            ...current,
            checking: false,
            available: false,
            downloading: false,
            progress: 0,
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
          downloading: false,
          progress: 0,
          version: update.version,
        }));

        if (manual) {
          toast.success(`Update v${update.version} available.`);
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
    try {
      await api.triggerUpdateCheck();
    } catch {
      await checkForUpdates(true);
    }
  }, [checkForUpdates, isTauriRuntime]);

  const downloadUpdate = useCallback(async () => {
    if (!isTauriRuntime) return;

    setUpdater((current) => ({
      ...current,
      downloading: true,
      progress: 0,
      done: false,
    }));

    try {
      const update = await check();
      if (!update) {
        if (!mountedRef.current) return;
        setUpdater((current) => ({
          ...current,
          downloading: false,
          available: false,
          progress: 0,
          version: undefined,
        }));
        toast.success("You're on the latest version.");
        return;
      }

      let contentLength = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        if (!mountedRef.current) return;
        if (event.event === "Started") {
          contentLength =
            (event.data as { contentLength?: number }).contentLength ?? 0;
          downloaded = 0;
          setUpdater((current) => ({
            ...current,
            downloading: true,
            progress: 0,
          }));
          return;
        }

        if (event.event === "Progress") {
          downloaded +=
            (event.data as { chunkLength?: number }).chunkLength ?? 0;
          const progress =
            contentLength > 0
              ? Math.round((downloaded / contentLength) * 100)
              : 0;
          setUpdater((current) => ({
            ...current,
            progress,
          }));
          return;
        }

        if (event.event === "Finished") {
          setUpdater((current) => ({
            ...current,
            downloading: false,
            done: true,
            progress: 100,
            available: false,
          }));
        }
      });

      await relaunch();
    } catch (error) {
      if (!mountedRef.current) return;
      setUpdater((current) => ({
        ...current,
        downloading: false,
      }));
      toast.error(`Update failed: ${String(error)}`);
    }
  }, [isTauriRuntime]);

  useEffect(() => {
    if (!isTauriRuntime) return;

    let unlisten: (() => void) | undefined;

    void checkForUpdates(false);

    void (async () => {
      unlisten = await listen("check-for-updates", () => {
        void checkForUpdates(true);
      });
    })();

    return () => {
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
          Update installed
        </span>
      ) : updater.downloading ? (
        <div className="flex flex-1 items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${updater.progress}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {updater.progress}%
          </span>
        </div>
      ) : updater.available ? (
        <button
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
          onClick={() => void downloadUpdate()}
          aria-label={`Install update version ${updater.version}`}
          title="Download and install update"
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
