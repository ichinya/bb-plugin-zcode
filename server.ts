import type { BbPluginApi, JsonValue } from "@get-bb/plugin-sdk";
import registerUsageSource from "./usage/server.js";
import { acpRpcContract } from "./acp-contract.js";
import { hostContract } from "./contract.js";
export { rpcContract } from "./contract.js";
export { registerUsageSource };
export const ZCODE_CLI_PROVIDER_ID = "acp-zcode-cli";

export function launchSpec(values: Readonly<Record<string, unknown>>) {
  const command = String(values.acpCommand ?? "").trim() || "zcode-acp";
  const native = String(values.nativeEntry ?? "").trim();
  return {
    displayName: "ZCode CLI", command, args: [],
    env: native ? { ZCODE_NATIVE_ENTRY: native } : {},
    permissionCli: { full: ["--bb-permission=full"], workspaceWrite: ["--bb-permission=accept-edits"] },
  };
}
export default async function plugin(bb: BbPluginApi): Promise<void> {
  const settings = bb.settings.define({
    acpCommand: {
      type: "string",
      label: "ACP executable / Исполняемый файл ACP",
      description: "Optional Rust zcode-acp override. Empty: installed below, then PATH. / Необязательный путь к Rust zcode-acp. Пусто: установленный ниже ACP, затем PATH.",
      default: "",
    },
    nativeEntry: {
      type: "string",
      label: "ZCode CLI path / Путь к CLI ZCode",
      description: "Full path to resources/glm/zcode.cjs on the agent machine. Leave empty for automatic discovery. / Полный путь к resources/glm/zcode.cjs на машине агента. Пусто — автоматический поиск.",
      default: "",
    },
  });
  let registered: { dispose(): void } | undefined;
  const register = (values: Readonly<Record<string, unknown>>) => {
    registered?.dispose();
    registered = bb.providers.register({
      id: ZCODE_CLI_PROVIDER_ID, displayName: "ZCode CLI", icon: "./icons/zcode.svg", family: "acp",
      strings: {
        signInHint: "Sign in through ZCode Desktop on the agent machine.",
        expiredHint: "Reconnect the account in ZCode Desktop, then retry.",
        installUrl: "https://github.com/ichinya/zcode-acp",
      },
      experimental_visibility: "installed",
      experimental_bridgeOptions: { acpLaunchSpec: launchSpec(values) as JsonValue, zcodeUseManagedAcp: !String(values.acpCommand ?? "").trim() },
      deriveProviderOptions: context => ({ acpLaunchSpec: launchSpec(context.settings) as JsonValue, zcodeUseManagedAcp: !String(context.settings.acpCommand ?? "").trim() }),
      models: { scope: "host" },
      maintenance: { health: true, usage: false, installation: false },
      capabilities: {
        supportsServiceTier: false, supportsNativeUserQuestion: false,
        supportsManualCompaction: false, supportsThreadArchive: false, supportsThreadRename: false,
        fork: "none", permissionModes: ["accept-edits", "full"], reasoningLevels: ["low", "high", "max"],
      },
      reasoningLevels: [{ id: "low", label: "Low" }, { id: "high", label: "High" }, { id: "max", label: "Max" }],
      composerActions: [],
    });
  };
  register(await settings.get());
  settings.onChange(values => register(values));
  bb.onDispose(() => registered?.dispose());
  const host = bb.hosts.experimental_client({ contract: hostContract });
  const connectedHost = async (hostId: string) => {
    const machine = (await bb.sdk.hosts.list()).find(item => item.id === hostId && item.type !== "ephemeral");
    if (!machine || machine.status !== "connected") throw new Error("Select a connected computer / Выберите подключённый компьютер");
  };
  bb.rpc.register(acpRpcContract, {
    "acp.hosts": async () => ({ hosts: (await bb.sdk.hosts.list()).filter(item => item.type !== "ephemeral").map(item => ({ id: item.id, name: item.name, connected: item.status === "connected" })) }),
    "acp.status": async ({ hostId, refresh }) => {
      await connectedHost(hostId);
      return host.call("acpStatus", { acpCommand: String((await settings.get()).acpCommand ?? "").trim(), refresh }, { hostId, timeoutMs: 45_000 });
    },
    "acp.install": async ({ hostId }) => {
      await connectedHost(hostId);
      return host.call("acpInstall", {}, { hostId, timeoutMs: 180_000 });
    },
    "acp.useManaged": async ({ hostId }) => {
      await connectedHost(hostId);
      const result = await host.call("acpStatus", { acpCommand: "", refresh: false }, { hostId, timeoutMs: 45_000 });
      if (result.current?.source !== "managed") throw new Error("Install ACP on this computer first");
      await settings.experimental_set({ acpCommand: "" });
      return { ok: true as const };
    },
  }, { experimental_discoverable: true });
  registerUsageSource(bb,
    async () => String((await settings.get()).nativeEntry ?? "").trim(),
    async () => String((await settings.get()).acpCommand ?? "").trim());
}
