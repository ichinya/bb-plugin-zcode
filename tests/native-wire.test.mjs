import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { launchSpec } from "../dist/server.js";

const fixture = fileURLToPath(new URL("./support/fake-native-server.mjs", import.meta.url));
function start(t, mode = "normal", permission = "accept-edits", fromPath = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zcode-acp-wire-"));
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^ZCODE_|TOKEN|SECRET|API_KEY|CREDENTIAL/.test(key)));
  Object.assign(env, { ZCODE_NATIVE_ENTRY: fixture, ZCODE_ACP_STATE_DIR: root, ZCODE_DATA_BASE_DIR: root, FAKE_NATIVE_MODE: mode,
    ...(process.env.ZCODE_ACP_BIN ? { ZCODE_ACP_BIN: process.env.ZCODE_ACP_BIN } : {}) });
  const spec = launchSpec({ acpCommand: fromPath ? "" : process.env.ZCODE_ACP_BIN, nativeEntry: fixture });
  if (fromPath && process.env.ZCODE_ACP_BIN) {
    // process.env is case-insensitive on Windows; the copied plain object is
    // not. CI exposes Path, so normalize before prepending the adapter folder.
    const inheritedPath = process.env.PATH || "";
    for (const key of Object.keys(env)) if (key.toUpperCase() === "PATH") delete env[key];
    env.PATH = path.dirname(process.env.ZCODE_ACP_BIN) + path.delimiter + inheritedPath;
  }
  Object.assign(env, spec.env, { ZCODE_NODE: process.execPath });
  // Match BB's applyPermissionCliArgs contract. Launch the registered command,
  // rather than a manually ordered command that could hide a broken spec.
  const index = Math.min(spec.permissionCli.insertAfterArgs ?? 0, spec.args.length);
  const flags = permission === "full" ? spec.permissionCli.full : spec.permissionCli.workspaceWrite;
  const args = [...spec.args.slice(0, index), ...flags, ...spec.args.slice(index)];
  const child = spawn(spec.command, args, { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const exit = once(child, "close"), pending = new Map(), updates = [];
  let nextId = 0, stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.stdin.on("error", () => {});
  readline.createInterface({ input: child.stdout }).on("line", line => {
    const m = JSON.parse(line);
    assert.equal(m.jsonrpc, "2.0");
    if (m.method === "session/update") { updates.push(m.params.update); return; }
    const request = pending.get(m.id);
    if (request) { clearTimeout(request.timer); pending.delete(m.id); m.error ? request.reject(Object.assign(new Error(m.error.message), { code: m.error.code })) : request.resolve(m.result); }
  });
  t.after(async () => {
    child.stdin.end();
    const timer = setTimeout(() => child.kill(), 3000);
    await exit; clearTimeout(timer);
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error("Agent closed")); }
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    updates, stderr: () => stderr,
    request(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("ACP fixture timeout")); child.kill(); }, 15_000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      });
    },
  };
}

for (const permission of ["full", "accept-edits"]) test(`BB native provider starts with ${permission} policy`, async t => {
  const agent = start(t, "normal", permission);
  await agent.request("initialize", { protocolVersion: 1 });
  const session = await agent.request("session/new", { cwd: process.cwd(), mcpServers: [] });
  assert.equal(session.modes.currentModeId, permission === "full" ? "yolo" : "edit");
  assert.equal(session.modes.availableModes.some(mode => mode.id === "yolo"), permission === "full");
  await agent.request("session/close", { sessionId: session.sessionId });
  assert.equal(agent.stderr(), "");
});

test("BB native provider can launch zcode-acp directly from PATH", async t => {
  const agent = start(t, "normal", "accept-edits", true);
  const info = (await agent.request("initialize")).agentInfo;
  assert.equal(info.name, "zcode-cli-acp");
  assert.match(info.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
  const session = await agent.request("session/new", { cwd: process.cwd(), mcpServers: [] });
  assert.equal(session.modes.currentModeId, "edit");
});
test("standalone ACP executable completes a fixture turn and closes cleanly", async t => {
  const agent = start(t);
  const capabilities = await agent.request("initialize", { protocolVersion: 1 });
  assert.equal(capabilities.agentInfo.name, "zcode-cli-acp");
  const session = await agent.request("session/new", { cwd: process.cwd(), mcpServers: [] });
  assert.ok(session.configOptions.some(option => option.id === "model"));
  assert.equal(session.modes.availableModes.some(mode => mode.id === "yolo"), false);
  const result = await agent.request("session/prompt", { sessionId: session.sessionId, prompt: [{ type: "text", text: "synthetic fixture only" }] });
  assert.equal(result.stopReason, "end_turn");
  assert.equal(agent.updates.filter(u => u.sessionUpdate === "agent_message_chunk").map(u => u.content.text).join(""), "Привет 🌍");
  await agent.request("session/close", { sessionId: session.sessionId });
  assert.equal(agent.stderr(), "");
});
test("native errors cannot expose native diagnostic contents through ACP", async t => {
  const agent = start(t, "error");
  await agent.request("initialize", { protocolVersion: 1 });
  const session = await agent.request("session/new", { cwd: process.cwd(), mcpServers: [] });
  await assert.rejects(agent.request("session/prompt", { sessionId: session.sessionId, prompt: [{ type: "text", text: "offline" }] }), error => error.code === -32000 && !error.message.includes("do-not-leak-fixture-secret"));
  await agent.request("session/close", { sessionId: session.sessionId });
});
