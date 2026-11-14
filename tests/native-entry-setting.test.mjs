import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import plugin, { registerUsageSource } from "../dist/server.js";
import host from "../dist/host.js";

test("the plugin forwards its current path to the CLI provider, including model discovery, without freezing registration", async () => {
  let value = "", acp = "", schema, change, declaration, disposed = 0;
  await plugin({
    settings: { define: definitions => { schema = definitions; return { get: async () => ({ nativeEntry: value, acpCommand: acp }), onChange: fn => { change = fn; } }; } },
    providers: { register(d) { declaration = d; return { dispose() { disposed++; } }; } },
    hosts: { experimental_client: () => ({ call: () => { throw new Error("No host discovery at plugin load"); } }) },
    rpc: { register() {} }, onDispose() {},
  });
  assert.deepEqual(Object.keys(schema), ["acpCommand", "nativeEntry"]);
  assert.equal(declaration.id, "acp-zcode-cli");
  assert.deepEqual(declaration.experimental_bridgeOptions.acpLaunchSpec.env, {});
  assert.equal(declaration.experimental_bridgeOptions.acpLaunchSpec.command, "zcode-acp");
  value = "  D:\\Custom ZCode\\resources\\glm\\zcode.cjs  ";
  acp = "  D:\\My Tools\\zcode-acp.exe  ";
  change({ acpCommand: acp, nativeEntry: value });
  assert.equal(disposed, 1);
  assert.equal(declaration.experimental_bridgeOptions.acpLaunchSpec.command, acp.trim());
  assert.deepEqual(declaration.experimental_bridgeOptions.acpLaunchSpec.env, { ZCODE_NATIVE_ENTRY: value.trim() });
  assert.equal(declaration.deriveProviderOptions({ settings: { acpCommand: "next.exe", nativeEntry: value } }).acpLaunchSpec.command, "next.exe");
  acp = "";
  value = " ";
  change({ acpCommand: acp, nativeEntry: value });
  assert.equal(declaration.experimental_bridgeOptions.acpLaunchSpec.command, "zcode-acp");
  assert.deepEqual(declaration.experimental_bridgeOptions.acpLaunchSpec.env, {});
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
  const acpCommand = process.env.ZCODE_ACP_BIN || "zcode-acp";
  assert.deepEqual(await host.handlers.inventory({ nativeEntry: entry, acpCommand }), { installed: true });
  assert.deepEqual(await host.handlers.inventory({ nativeEntry: path.join(root, "missing"), acpCommand }), { installed: false });
  assert.equal(process.env.ZCODE_NATIVE_ENTRY, original);
  await assert.rejects(host.handlers.inventory({ nativeEntry: entry, acpCommand: path.join(root, "missing-acp.exe") }), /executable not found/);
});

test("ACP settings target the selected host and activate a managed binary only on request", async () => {
  let values = { acpCommand: "custom-acp", nativeEntry: "" }, callbacks = {}, changed, writes = 0;
  const calls = [];
  await plugin({
    settings: { define: () => ({ get: async () => values, onChange: cb => { changed = cb; }, experimental_set: async patch => { writes++; values = { ...values, ...patch }; changed(values); return values; } }) },
    providers: { register: () => ({ dispose() {} }) },
    hosts: { experimental_client: ({ contract }) => ({ call: async (method, input, options) => {
      contract[method].input.parse(input);
      calls.push({ method, input, hostId: options.hostId, timeoutMs: options.timeoutMs });
      return method === "acpStatus" ? { current: { source: "managed" } } : { version: "0.3.1", executable: "/plugin/acp/zcode-acp" };
    } }) },
    sdk: { hosts: { list: async () => [{ id: "host-one", name: "Computer", type: "local", status: "connected" }, { id: "offline", name: "Offline", type: "ssh", status: "disconnected" }] } },
    rpc: { register: (_, handlers) => { Object.assign(callbacks, handlers); } }, onDispose() {},
  });
  assert.equal(calls.length, 0);
  assert.equal((await callbacks["acp.hosts"]({})).hosts.length, 2);
  await callbacks["acp.status"]({ hostId: "host-one", refresh: true });
  assert.deepEqual(calls[0], { method: "acpStatus", input: { acpCommand: "custom-acp", refresh: true }, hostId: "host-one", timeoutMs: 45000 });
  await callbacks["acp.install"]({ hostId: "host-one" });
  assert.equal(calls[1].method, "acpInstall"); assert.equal(calls[1].hostId, "host-one");
  assert.equal(writes, 0);
  assert.equal(values.acpCommand, "custom-acp");
  await callbacks["acp.useManaged"]({ hostId: "host-one" });
  assert.equal(values.acpCommand, ""); assert.equal(writes, 1);
  await assert.rejects(callbacks["acp.install"]({ hostId: "offline" }), /connected computer/);
});
