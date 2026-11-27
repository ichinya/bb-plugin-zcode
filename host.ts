export { default } from "./usage/host.js";
import { experimental_acpProviderBridge as acp } from "@get-bb/plugin-sdk/provider-bridge/acp";
import {
  experimental_defineProviderBridge,
  providerInstallationRunParamsSchema, providerInstallationRunResultSchema,
  providerInstallationStatusParamsSchema, providerInstallationStatusSchema,
} from "@get-bb/plugin-sdk/provider-bridge";
import { resolveBridgeLine, bridgeInstallationDataDir } from "./scripts/managed-acp.mjs";
import { withModelCatalog } from "./scripts/model-catalog.mjs";
import { createDesktopInstaller } from "./scripts/zcode-installer.mjs";
import { AcpSetupError, createAcpGuard } from "./scripts/acp-installer.mjs";

let dataDir = "";
let desktop: ReturnType<typeof createDesktopInstaller>;
let ensureRustAcp: ReturnType<typeof createAcpGuard>;
const catalogMethods = new Set(["model/list", "thread/start", "thread/resume", "thread/fork", "turn/start"]);

function nativeEntry(options: Record<string, unknown> | undefined) {
  const spec = options?.acpLaunchSpec as { env?: { ZCODE_NATIVE_ENTRY?: unknown } } | undefined;
  return typeof spec?.env?.ZCODE_NATIVE_ENTRY === "string" ? spec.env.ZCODE_NATIVE_ENTRY : "";
}

// BB runs the returned argv on the provider's machine. Reuse the same
// installer and persistent lock as the plugin settings action.
export async function runDesktopMaintenance(directory: string, action: string, entry: string) {
  const installer = createDesktopInstaller({ dataDir: directory });
  installer.start({ signal: AbortSignal.timeout(15 * 60_000), nativeEntry: entry, upgrade: action === "update" });
  const result = await installer.wait();
  if (result.phase !== "installed") throw new Error(`ZCode installation did not complete (${result.error ?? result.phase}).`);
}

async function installationStatus(params: ReturnType<typeof providerInstallationStatusParamsSchema.parse>) {
  const status = await desktop.check(nativeEntry(params.providerOptions), false, params.checkUpdates && !params.requirement);
  const installed = Boolean(status.currentEntry);
  const installAction = params.requirement ? null
    : status.updateAvailable && status.canUpdate ? { kind: "update", label: "Update", command: "Update ZCode" }
    : !installed && !status.customPath && status.latestVersion ? { kind: "install", label: "Install", command: "Install ZCode" }
    : null;
  return providerInstallationStatusSchema.parse({
    currentVersion: status.currentVersion,
    latestVersion: status.latestVersion,
    executableName: "ZCode",
    executablePath: status.currentEntry,
    installAction,
    installSource: installed ? "external" : "notInstalled",
    installed,
    needsUpdate: !params.requirement && status.updateAvailable,
    minimumSupportedVersion: null,
    npmGlobalPackageVersion: null,
    npmPackageName: null,
    versionUnsupported: false,
  });
}

async function installationRun(rawParams: unknown) {
  const params = providerInstallationRunParamsSchema.parse(rawParams);
  const status = await installationStatus({ ...params, checkUpdates: true });
  if (status.installAction?.kind !== params.action) {
    const unavailable = { available: false, message: "No ZCode installation action is available on this machine. Check the ZCode plugin settings." };
    return providerInstallationRunResultSchema.parse(unavailable);
  }
  return providerInstallationRunResultSchema.parse({
    available: true,
    command: {
      command: process.execPath,
      args: ["--input-type=module", "-e",
        "const { runDesktopMaintenance } = await import(process.argv[1]); await runDesktopMaintenance(...process.argv.slice(2));",
        import.meta.url, dataDir, params.action, nativeEntry(params.providerOptions)],
      displayCommand: status.installAction.command,
    },
    verification: status.latestVersion ? { kind: "version_at_least", version: status.latestVersion } : { kind: "installed" },
  });
}

function reply(id: unknown, payload: { result: unknown } | { error: { code: number; message: string } }) {
  if (id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, ...payload }) + "\n");
}

export const experimental_providerBridge = experimental_defineProviderBridge({
  start(context) {
    dataDir = bridgeInstallationDataDir(context.dataDir);
    desktop = createDesktopInstaller({ dataDir });
    ensureRustAcp = createAcpGuard({ dataDir });
    acp.start?.(context);
  },
  async handleLine(line) {
    let request;
    try { request = JSON.parse(line); }
    catch { acp.handleLine(line); return; }
    try {
      if (request?.method === "provider/installation/status") {
        reply(request.id, { result: await installationStatus(providerInstallationStatusParamsSchema.parse(request.params)) });
        return;
      }
      if (request?.method === "provider/installation/run") {
        reply(request.id, { result: await installationRun(request.params) });
        return;
      }
      if (catalogMethods.has(request?.method)) await ensureRustAcp(request.params?.providerOptions ?? request.params?.options?.providerOptions);
      const resolvedLine = resolveBridgeLine(line, dataDir);
      if (!catalogMethods.has(request?.method)) { acp.handleLine(resolvedLine); return; }
      const resolved = JSON.parse(resolvedLine);
      const spec = (resolved.params?.providerOptions ?? resolved.params?.options?.providerOptions)?.acpLaunchSpec;
      if (spec?.env) spec.env = await withModelCatalog(dataDir, spec.env);
      acp.handleLine(JSON.stringify(resolved));
    } catch (error) {
      const message = error instanceof AcpSetupError ? error.message : "ZCode provider request failed. Check installation and access in the plugin settings.";
      reply(request?.id, { error: { code: -32000, message } });
    }
  },
  onClose: () => acp.onClose?.(),
  onSigterm: () => acp.onSigterm?.(),
  onSigint: () => acp.onSigint?.(),
});
