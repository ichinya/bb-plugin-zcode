import assert from "node:assert/strict";
import test from "node:test";
import { registerUsageSource as plugin } from "../dist/server.js";
test("BB source inventory is local-only and fetching one resource collects only that plan", async () => {
  let handlers, contract; const calls = [];
  const bb = {
    hosts: { experimental_client: () => ({ call: async (method, input) => { calls.push({ method, input }); return method === "inventory" ? { installed: true } : { accountKey: null, observedAt: 1, usage: { status: "ok", plan: null, accountEmail: null, planLabel: "Test", windows: [] } }; } }) },
    sdk: { hosts: { list: async () => [{ id: "host-one", name: "Desktop", type: "local", status: "connected" }] } },
    rpc: { register: (c, h, options) => { contract = c; handlers = h; assert.equal(options.experimental_discoverable, true); } }, onDispose() {},
  };
  plugin(bb);
  const listed = await handlers["provider-usage.v1.listResources"]({});
  contract["provider-usage.v1.listResources"].output.parse(listed);
  assert.equal(listed.resources.length, 2); assert.equal(calls.length, 1); assert.equal(calls[0].method, "inventory");
  assert.notEqual(listed.resources[0].providerId, listed.resources[1].providerId);
  const result = await handlers["provider-usage.v1.getResource"]({ resourceId: listed.resources[1].id, refresh: true });
  contract["provider-usage.v1.getResource"].output.parse(result);
  assert.deepEqual(calls[1], { method: "collect", input: { plan: "start", refresh: true } });
  await assert.rejects(handlers["provider-usage.v1.getResource"]({ resourceId: '["other","coding"]', refresh: true }), /no longer exists/);
});
