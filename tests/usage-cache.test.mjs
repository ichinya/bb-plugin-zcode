import assert from "node:assert/strict";
import test from "node:test";
import { PlanUsageCache } from "../usage/usage-cache.mjs";

test("cache refreshes only the requested plan, coalesces requests, and invalidates on account change", async () => {
  let now = 100, calls = 0;
  const cache = new PlanUsageCache({ now: () => now });
  const collect = async () => { calls++; return { status: "ok", windows: [] }; };
  await Promise.all([cache.get("coding", "one", false, collect), cache.get("coding", "one", true, collect)]);
  assert.equal(calls, 1);
  await cache.get("coding", "one", false, collect); assert.equal(calls, 1);
  await cache.get("start", "one", false, collect); assert.equal(calls, 2);
  await cache.get("coding", "two", false, collect); assert.equal(calls, 3);
  now += 61000; await cache.get("coding", "two", false, collect); assert.equal(calls, 4);
  const failure = await cache.get("coding", "two", true, async () => ({ status: "error", message: "unavailable" }));
  assert.equal(failure.observedAt, now); assert.equal(failure.usage.status, "error");
  assert.equal((await cache.get("start", "different", true, async () => ({ status: "error" }))).observedAt, null);
});
