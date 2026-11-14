import { experimental_defineHostEntry } from "@get-bb/plugin-sdk/host";
import { hostContract } from "../contract.js";
import { usageSchema } from "./contract.js";
import { selectAcp } from "../scripts/managed-acp.mjs";
import { createAcpInstaller } from "../scripts/acp-installer.mjs";
import { runJson } from "../scripts/native-cli.mjs";
import { PlanUsageCache } from "./usage-cache.mjs";
const cache = new PlanUsageCache();
const installers = new Map<string, ReturnType<typeof createAcpInstaller>>();
function installer(dataDir: string) {
  let value = installers.get(dataDir);
  if (!value) { value = createAcpInstaller({ dataDir }); installers.set(dataDir, value); }
  return value;
}
export default experimental_defineHostEntry({
  contract: hostContract,
  handlers: {
    acpStatus: async (input, context) => installer(context.experimental_paths.dataDir).status({ ...input, signal: AbortSignal.any([context.signal, context.lifecycle.signal, AbortSignal.timeout(40_000)]) }),
    acpInstall: async (_input, context) => installer(context.experimental_paths.dataDir).install({ signal: AbortSignal.any([context.signal, context.lifecycle.signal, AbortSignal.timeout(170_000)]) }),
    inventory: async (input, context) => {
      const acpCommand = selectAcp(context?.experimental_paths?.dataDir, input.acpCommand).executable;
      const result = await runJson(["inventory"], { ...input, acpCommand, timeout: 8_000 }) as { schemaVersion?: number; installed?: boolean };
      if (result.schemaVersion !== 1 || typeof result.installed !== "boolean") throw new Error("Unsupported zcode-acp inventory response");
      return { installed: result.installed };
    },
    collect: async ({ plan, refresh, ...input }, context) => {
      const signal = AbortSignal.any([context.signal, context.lifecycle.signal]);
      const options = { ...input, acpCommand: selectAcp(context.experimental_paths.dataDir, input.acpCommand).executable, signal };
      const account = await runJson(["account-scope"], { ...options, timeout: 8_000 }) as { schemaVersion?: number; scope?: string };
      if (account.schemaVersion !== 1 || typeof account.scope !== "string") throw new Error("Unsupported zcode-acp account response");
      const scope = JSON.stringify([options.acpCommand, input.nativeEntry || process.env.ZCODE_NATIVE_ENTRY || "", account.scope]);
      return cache.get(plan, scope, refresh, async () => usageSchema.parse(await runJson(["usage", "--plan", plan], { ...options, timeout: 55_000 })));
    },
  },
  dispose: async () => { cache.clear(); installers.clear(); },
});
