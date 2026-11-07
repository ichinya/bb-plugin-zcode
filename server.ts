import type { BbPluginApi, JsonValue } from "@get-bb/plugin-sdk";
import { hostContract, rpcContract as legacyRpcContract, type HostEntry } from "./contract.js";
import registerUsageSource from "./usage/server.js";
import { rpcContract as usageRpcContract } from "./usage/contract.js";

export const rpcContract = { ...legacyRpcContract, ...usageRpcContract };
export { registerUsageSource };

// Retain the original macOS provider ID for existing GUI-backed chats.
// Native CLI configuration belongs to the separately registered ACP agent.
export const ZCODE_PROVIDER_ID = "zcode";
export const ZCODE_AGENT_COMMAND = "zcode-acp";

export default function plugin(bb: BbPluginApi): void {
  registerUsageSource(bb);
  const host = bb.hosts.experimental_client({ contract: hostContract });

  bb.providers.register({
    id: ZCODE_PROVIDER_ID,
    displayName: "ZCode",
    icon: "./icons/zcode.svg",
    family: "acp",
    strings: {
      signInHint: "Sign in inside the ZCode app on this Mac (never run `zcode login`).",
      expiredHint: "The ZCode session expired. Sign in inside the ZCode app, then reload.",
      installUrl: "https://zcode.z.ai",
    },
    experimental_visibility: "installed",
    experimental_bridgeOptions: {
      acpLaunchSpec: { displayName: "ZCode", command: ZCODE_AGENT_COMMAND, args: [], env: {} },
    },
    // Permissions still follow the legacy launcher's argv contract.
    deriveProviderOptions() {
      return {
        acpLaunchSpec: {
          displayName: "ZCode",
          command: ZCODE_AGENT_COMMAND,
          args: [],
          env: {},
          permissionCli: { full: ["--bb-permission=full"], workspaceWrite: ["--bb-permission=accept-edits"] },
        } as JsonValue,
      };
    },
    models: { scope: "host" },
    maintenance: { health: true, usage: false, installation: false },
    capabilities: {
      supportsServiceTier: false,
      supportsNativeUserQuestion: false,
      supportsManualCompaction: false,
      supportsThreadArchive: false,
      supportsThreadRename: false,
      fork: "none",
      permissionModes: ["accept-edits", "full"],
      reasoningLevels: ["low", "high", "max"],
    },
    reasoningLevels: [
      { id: "low", label: "Low" },
      { id: "high", label: "High" },
      { id: "max", label: "Max" },
    ],
    composerActions: [],
  });

  bb.rpc.register(legacyRpcContract, {
    async hosts({ refresh, hostId }) {
      const listed = await bb.sdk.hosts.list();
      const rows = listed.filter((h) => !hostId || h.id === hostId);
      const hosts: HostEntry[] = await Promise.all(
        rows.map(async (h): Promise<HostEntry> => {
          const connected = h.status === "connected";
          if (!connected) return { hostId: h.id, name: h.name || h.id, connected, status: null, error: null };
          try {
            const method = refresh === "models" ? "refreshModels" : refresh === "quota" ? "readQuota" : "status";
            const status = await host.call(method, {}, { hostId: h.id });
            return { hostId: h.id, name: h.name || h.id, connected, status, error: null };
          } catch (e) {
            return { hostId: h.id, name: h.name || h.id, connected, status: null, error: e instanceof Error ? e.message : String(e) };
          }
        }),
      );
      // keep the machines that have ZCode first
      hosts.sort((a, b) => Number(b.status?.appFound ?? false) - Number(a.status?.appFound ?? false));
      return { hosts };
    },
  });
}
