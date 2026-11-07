import { experimental_defineHostEntry } from "@get-bb/plugin-sdk/host";
import { hostContract } from "./contract.js";
import { findNativeEntry, getAccountFingerprint, collectPlanUsage } from "zcode-acp";
import { PlanUsageCache } from "./usage-cache.mjs";
const cache = new PlanUsageCache();
export default experimental_defineHostEntry({
  contract: hostContract,
  handlers: {
    inventory: async () => { try { findNativeEntry(); return { installed: true }; } catch { return { installed: false }; } },
    collect: async ({ plan, refresh }, context) => {
      const scope = await getAccountFingerprint();
      return cache.get(plan, scope, refresh, async () => collectPlanUsage(plan, { signal: AbortSignal.any([context.signal, context.lifecycle.signal]) }));
    },
  },
  dispose: async () => cache.clear(),
});
