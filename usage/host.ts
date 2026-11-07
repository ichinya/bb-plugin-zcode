import { experimental_defineHostEntry } from "@get-bb/plugin-sdk/host";
import { hostContract } from "./contract.js";
import { findNativeEntry, getAccountFingerprint, collectPlanUsage } from "zcode-acp";
import { PlanUsageCache } from "./usage-cache.mjs";
const cache = new PlanUsageCache();
export default experimental_defineHostEntry({
  contract: hostContract,
  handlers: {
    inventory: async ({ nativeEntry }) => { try { findNativeEntry({ env: { ...process.env, ...(nativeEntry ? { ZCODE_NATIVE_ENTRY: nativeEntry } : {}) } }); return { installed: true }; } catch { return { installed: false }; } },
    collect: async ({ plan, refresh, nativeEntry }, context) => {
      const env = { ...process.env, ...(nativeEntry ? { ZCODE_NATIVE_ENTRY: nativeEntry } : {}) };
      const scope = JSON.stringify([env.ZCODE_NATIVE_ENTRY ?? "", await getAccountFingerprint({ env })]);
      return cache.get(plan, scope, refresh, async () => collectPlanUsage(plan, { env, signal: AbortSignal.any([context.signal, context.lifecycle.signal]) }));
    },
  },
  dispose: async () => cache.clear(),
});
