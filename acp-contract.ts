import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";
const hostId = z.string().min(1);
const installation = z.object({ version: z.string(), executable: z.string() });
export const acpStatus = z.object({
  target: z.string().nullable(),
  current: installation.extend({ source: z.enum(["custom", "managed", "path"]) }).nullable(),
  currentError: z.string().nullable(),
  managed: installation.nullable(),
  latest: z.object({ version: z.string(), ready: z.boolean() }).nullable(),
  releaseError: z.string().nullable(),
  releasesUrl: z.string(),
});
export const acpRpcContract = defineRpcContract({
  "acp.hosts": { input: z.object({}), output: z.object({ hosts: z.array(z.object({ id: hostId, name: z.string(), connected: z.boolean() })) }) },
  "acp.status": { input: z.object({ hostId, refresh: z.boolean() }), output: acpStatus },
  "acp.install": { input: z.object({ hostId }), output: installation },
  "acp.useManaged": { input: z.object({ hostId }), output: z.object({ ok: z.literal(true) }) },
});
export const acpHostContract = defineRpcContract({
  acpStatus: { input: z.object({ acpCommand: z.string(), refresh: z.boolean() }), output: acpStatus },
  acpInstall: { input: z.object({}), output: installation },
});
