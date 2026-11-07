import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import plugin, { registerUsageSource } from "../dist/server.js";
import host from "../dist/host.js";

test("the plugin forwards its current path to the CLI provider, including model discovery, without freezing registration", async () => {
  let value = "", schema, provider, resolve;
  plugin({
    settings: { define: definitions => { schema = definitions; return { get: async () => ({ nativeEntry: value }) }; } },
    providers: { register() {}, experimental_contributeEnv: (id, callback) => { provider = id; resolve = callback; } },
    hosts: { experimental_client: () => ({ call: () => { throw new Error("No host discovery at plugin load"); } }) },
    rpc: { register() {} }, onDispose() {},
  });
  assert.deepEqual(Object.keys(schema), ["nativeEntry"]);
  assert.equal(provider, "acp-zcode-cli");
  const context = { hostId: "host-one", threadId: null, projectId: null };
  assert.deepEqual(await resolve(context), []);
  value = "  D:\\Custom ZCode\\resources\\glm\\zcode.cjs  ";
  assert.deepEqual(await resolve(context), [{ name: "ZCODE_NATIVE_ENTRY", value: value.trim(), reason: "ZCode CLI installation path" }]);
  value = " ";
  assert.deepEqual(await resolve(context), []);
});

test("inventory and quota requests use the latest configured path on the target host", async () => {
  let value = "/Custom ZCode/resources/glm/zcode.cjs", handlers;
  const calls = [];
  registerUsageSource({
    hosts: { experimental_client: ({ contract }) => ({ call: async (method, input, options) => {
      contract[method].input.parse(input);
      calls.push({ method, input, hostId: options.hostId });
      return method === "inventory" ? { installed: true } : {};
    } }) },
    sdk: { hosts: { list: async () => [{ id: "host-one", name: "Desktop", type: "local", status: "connected" }] } },
    rpc: { register: (_, callbacks) => { handlers = callbacks; } }, onDispose() {},
  }, async () => value);
  const resources = (await handlers["provider-usage.v1.listResources"]({})).resources;
  assert.equal(calls[0].input.nativeEntry, value);
  value = "/Other ZCode/resources/glm/zcode.cjs";
  await handlers["provider-usage.v1.getResource"]({ resourceId: resources[1].id, refresh: true });
  assert.deepEqual(calls[1], { method: "collect", input: { plan: "start", refresh: true, nativeEntry: value }, hostId: "host-one" });
  value = "";
  await handlers["provider-usage.v1.getResource"]({ resourceId: resources[0].id, refresh: false });
  assert.deepEqual(calls[2].input, { plan: "coding", refresh: false });
});

test("host inventory honors the configured path without changing its process environment", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zcode-entry-setting-"));
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const entry = path.join(root, "custom install", "zcode.cjs");
  fs.mkdirSync(path.dirname(entry)); fs.writeFileSync(entry, "");
  const original = process.env.ZCODE_NATIVE_ENTRY;
  assert.deepEqual(await host.handlers.inventory({ nativeEntry: entry }), { installed: true });
  assert.deepEqual(await host.handlers.inventory({ nativeEntry: path.join(root, "missing") }), { installed: false });
  assert.equal(process.env.ZCODE_NATIVE_ENTRY, original);
});
