import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { hostContract } from "../contract.js";
import { rpcContract, resourceIdentity, LIST, GET } from "./contract.js";
export { rpcContract } from "./contract.js";

// Quota sources contribute usage rows without adding selectable chat agents.
export default function registerUsageSource(bb: BbPluginApi, readNativeEntry: () => Promise<string> = async () => "") {
  const host = bb.hosts.experimental_client({ contract: hostContract });
  const known = new Set<string>();
  bb.rpc.register(rpcContract, {
    [LIST]: async () => {
      const nativeEntry = (await readNativeEntry()).trim();
      const machines = (await bb.sdk.hosts.list()).filter(machine => machine.type !== "ephemeral");
      const resources = [];
      for (const machine of machines) {
        if (machine.status === "connected") {
          try {
            const result = await host.call("inventory", nativeEntry ? { nativeEntry } : {}, { hostId: machine.id, signal: AbortSignal.timeout(10_000) });
            if (result.installed) known.add(machine.id); else known.delete(machine.id);
          } catch { /* Keep last known inventory for a temporarily busy host. */ }
        }
        if (!known.has(machine.id)) continue;
        for (const plan of ["coding", "start"] as const) {
          const label = plan === "coding" ? "ZCode Coding Plan" : "ZCode Start Plan";
          resources.push({ id: JSON.stringify([machine.id, plan]), providerId: label, label, accountKey: null,
            scope: { kind: "host" as const, hostId: machine.id, hostName: machine.name } });
        }
      }
      return { resources };
    },
    [GET]: async ({ resourceId, refresh }) => {
      let identity: unknown;
      try { identity = JSON.parse(resourceId); } catch { throw new Error("Unknown ZCode usage resource"); }
      const [hostId, plan] = resourceIdentity.parse(identity);
      if (!known.has(hostId)) throw new Error("ZCode usage resource no longer exists");
      const nativeEntry = (await readNativeEntry()).trim();
      return host.call("collect", { plan, refresh, ...(nativeEntry ? { nativeEntry } : {}) }, { hostId, signal: AbortSignal.timeout(40_000) });
    },
  }, { experimental_discoverable: true, experimental_description: "Independent host-local ZCode Coding Plan and Start Plan quota resources." });
  bb.onDispose(() => known.clear());
}
