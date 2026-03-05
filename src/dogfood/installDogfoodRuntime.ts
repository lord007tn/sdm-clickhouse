import type {
  CommandMessage,
  ConnectionDiagnostics,
  ConnectionInput,
  ConnectionProfile,
  QueryResult,
} from "@/types";

type DogfoodState = {
  profiles: ConnectionProfile[];
  secretsById: Record<string, string>;
};

type DogfoodWindow = Window & {
  __TAURI_INTERNALS__?: {
    invoke?: (
      command: string,
      args?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
};

const DOGFOOD_STORAGE_KEY = "sdm_clickhouse_dogfood_runtime_v1";

function nowIso() {
  return new Date().toISOString();
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readState(): DogfoodState {
  try {
    const raw = window.localStorage.getItem(DOGFOOD_STORAGE_KEY);
    if (!raw) return { profiles: [], secretsById: {} };
    const parsed = JSON.parse(raw) as Partial<DogfoodState>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      secretsById:
        parsed.secretsById && typeof parsed.secretsById === "object"
          ? (parsed.secretsById as Record<string, string>)
          : {},
    };
  } catch {
    return { profiles: [], secretsById: {} };
  }
}

function writeState(state: DogfoodState) {
  window.localStorage.setItem(DOGFOOD_STORAGE_KEY, JSON.stringify(state));
}

function toProfile(
  payload: ConnectionInput,
  existing?: ConnectionProfile,
): ConnectionProfile {
  const createdAt = existing?.createdAt ?? nowIso();
  return {
    id: existing?.id ?? payload.id ?? crypto.randomUUID(),
    name: payload.name,
    host: payload.host || "localhost",
    port: payload.port || 8123,
    database: payload.database || "default",
    username: payload.username || "default",
    secure: Boolean(payload.secure),
    tlsInsecureSkipVerify: Boolean(payload.tlsInsecureSkipVerify),
    caCertPath: payload.caCertPath ?? "",
    sshTunnel: payload.sshTunnel ?? {
      enabled: false,
      host: "",
      port: 22,
      username: "",
      localPort: 8123,
    },
    timeoutMs: payload.timeoutMs ?? 30_000,
    createdAt,
    updatedAt: nowIso(),
  };
}

function diagnosticsFor(payload: ConnectionInput): ConnectionDiagnostics {
  const host = payload.host.toLowerCase();
  const fail = host.includes("fail") || host.includes("bad");
  return {
    ok: !fail,
    category: fail ? "network" : "ok",
    latencyMs: fail ? 3_000 : 55,
    serverVersion: fail ? undefined : "24.8.1.9999-dogfood",
    detail: fail
      ? "Dogfood runtime simulated failure."
      : "Dogfood runtime simulated success.",
  };
}

export function installDogfoodRuntime() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("dogfood") !== "1") return false;

  const target = window as DogfoodWindow;
  if (target.__TAURI_INTERNALS__?.invoke) return true;

  const invoke = async (command: string, args?: Record<string, unknown>) => {
    const state = readState();

    switch (command) {
      case "app_startup_status":
        return "Dogfood runtime active.";
      case "connection_list":
        return state.profiles;
      case "connection_save": {
        const payload = args?.payload as ConnectionInput | undefined;
        if (!payload) throw new Error("Missing payload.");
        const existing = payload.id
          ? state.profiles.find((item) => item.id === payload.id)
          : undefined;
        const profile = toProfile(payload, existing);
        const hasPassword = (payload.password ?? "").trim().length > 0;
        if (!existing && !hasPassword) {
          throw new Error(
            "Password is required when creating a new connection.",
          );
        }
        state.profiles = payload.id
          ? state.profiles.map((item) =>
              item.id === payload.id ? profile : item,
            )
          : [...state.profiles, profile];
        if (hasPassword) {
          state.secretsById[profile.id] = payload.password as string;
        }
        writeState(state);
        await delay(120);
        return profile;
      }
      case "connection_delete": {
        const connectionId = String(args?.connectionId ?? "");
        state.profiles = state.profiles.filter(
          (item) => item.id !== connectionId,
        );
        delete state.secretsById[connectionId];
        writeState(state);
        return { message: "Connection deleted." } satisfies CommandMessage;
      }
      case "connection_test": {
        const payload = args?.payload as ConnectionInput | undefined;
        if (!payload) throw new Error("Missing payload.");
        const password =
          (payload.password ?? "").trim() ||
          (payload.id ? state.secretsById[payload.id] : "");
        await delay(220);
        if (!password) throw new Error("Password is required.");
        const diagnostics = diagnosticsFor(payload);
        if (!diagnostics.ok) throw new Error(`[network] ${diagnostics.detail}`);
        return { message: "Connection successful." } satisfies CommandMessage;
      }
      case "connection_diagnostics": {
        const payload = args?.payload as ConnectionInput | undefined;
        if (!payload) throw new Error("Missing payload.");
        await delay(150);
        return diagnosticsFor(payload);
      }
      case "schema_list_databases":
        return [{ name: "default" }];
      case "history_list":
      case "snippet_list":
      case "audit_list":
      case "logs_list":
        return [];
      case "query_execute": {
        await delay(140);
        return {
          queryId: `dogfood-${crypto.randomUUID()}`,
          columns: ["ok"],
          rows: [{ ok: 1 }],
          rowCount: 1,
          page: 1,
          pageSize: 100,
          durationMs: 5,
        } satisfies QueryResult;
      }
      default:
        return null;
    }
  };

  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: { invoke },
    configurable: true,
    writable: true,
  });
  return true;
}
