import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";
const text = z.string().min(1);
const fields = { plan: z.object({ id: text, multiplier: z.number().int().positive().nullable() }).nullable().default(null), accountEmail: z.string().nullable(), planLabel: z.string().nullable() };
export const usageSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), ...fields, windows: z.array(z.object({ kind: z.enum(["five-hour", "daily", "weekly", "custom"]), id: text, label: text, usedPercent: z.number().finite().nonnegative(), resetsAt: z.string().nullable(), model: z.string().nullable(), cost: z.object({ usedUsdCents: z.number().nonnegative(), limitUsdCents: z.number().positive() }).nullable() })) }),
  ...(["not_installed", "unauthenticated", "expired"] as const).map(status => z.object({ status: z.literal(status), ...fields })),
  z.object({ status: z.literal("error"), ...fields, message: text }),
]);
export const measurement = z.object({ accountKey: text.nullable(), observedAt: z.number().int().nonnegative().nullable(), usage: usageSchema });
export const resourceIdentity = z.tuple([text, z.enum(["coding", "start"])]);
export const LIST = "provider-usage.v1.listResources";
export const GET = "provider-usage.v1.getResource";
export const rpcContract = defineRpcContract({
  [LIST]: { input: z.object({}), output: z.object({ resources: z.array(z.object({ id: text, providerId: text, label: text, accountKey: text.nullable(), scope: z.object({ kind: z.literal("host"), hostId: text, hostName: text }) })) }), experimental_description: "Local ZCode inventory only; no quota HTTP requests." },
  [GET]: { input: z.object({ resourceId: text, refresh: z.boolean() }), output: measurement, experimental_description: "Read one ZCode plan's actual quota; never collects its sibling plan." },
});
export const hostContract = defineRpcContract({
  inventory: { input: z.object({ nativeEntry: z.string().trim().min(1).optional() }), output: z.object({ installed: z.boolean() }), experimental_retryable: true },
  collect: { input: z.object({ plan: z.enum(["coding", "start"]), refresh: z.boolean(), nativeEntry: z.string().trim().min(1).optional() }), output: measurement },
});
