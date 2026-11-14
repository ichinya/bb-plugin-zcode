import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { zipSync } from "fflate";
import { createAcpInstaller } from "../scripts/acp-installer.mjs";
import { buildTarget, managedInstallation, selectAcp, resolveBridgeLine, RELEASES_URL } from "../scripts/managed-acp.mjs";
import { resolveCommand } from "../scripts/native-cli.mjs";

const executable = process.platform === "win32" ? "zcode-acp.exe" : "zcode-acp";
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zcode-acp-installer-"));
  t.after(() => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  let version = "0.3.1", mode = "ok", fetches = 0;
  let zip = zipSync({ [executable]: Buffer.from("fake Rust binary"), LICENSE: Buffer.from("license") });
  const name = `zcode-acp-${buildTarget()}.zip`;
  const fetchImpl = async (url, options) => {
    fetches++;
    options.signal?.throwIfAborted();
    if (mode === "http") return new Response("", { status: 503 });
    if (url.includes("api.github.com")) {
      if (mode === "none") return new Response("", { status: 404 });
      const prefix = `${RELEASES_URL}/download/v${version}/`;
      return Response.json({ tag_name: `v${version}`, draft: false, prerelease: false, assets: mode === "pending" ? [] : [name, `${name}.sha256`].map(name => ({ name, state: "uploaded", browser_download_url: prefix + name })) });
    }
    if (url.endsWith(".sha256")) return new Response(`${mode === "checksum" ? "0".repeat(64) : createHash("sha256").update(zip).digest("hex")}  ${name}\n`);
    return new Response(zip);
  };
  const run = async () => ({ name: "zcode-acp", runtime: mode === "wrong-runtime" ? "node" : "rust", version });
  const installer = createAcpInstaller({ dataDir: root, fetchImpl, run });
  return { root, installer, fetchImpl, setVersion: v => { version = v; }, setMode: v => { mode = v; }, setZip: value => { zip = value; }, fetches: () => fetches };
}

test("release target names match the CI matrix; unsupported architectures stay unavailable", () => {
  assert.equal(buildTarget("win32", "x64"), "x86_64-pc-windows-msvc");
  assert.equal(buildTarget("darwin", "arm64"), "aarch64-apple-darwin");
  assert.equal(buildTarget("darwin", "x64"), "x86_64-apple-darwin");
  assert.equal(buildTarget("linux", "x64"), "x86_64-unknown-linux-gnu");
  assert.equal(buildTarget("win32", "arm64"), null);
});

test("install and update select separate binaries, keep the old file and resolve chat/model/health commands", async t => {
  const f = fixture(t);
  const first = await f.installer.install();
  assert.equal(first.version, "0.3.1");
  assert.equal((await f.installer.status()).current.source, "managed");
  assert.equal(selectAcp(f.root).executable, first.executable);
  f.setVersion("0.3.2");
  const next = await f.installer.install();
  assert.notEqual(first.executable, next.executable);
  assert.ok(fs.existsSync(first.executable));
  assert.equal(managedInstallation(f.root).version, "0.3.2");
  for (const method of ["thread/start", "turn/start", "model/list", "provider/health"]) {
    const request = { jsonrpc: "2.0", id: 1, method, params: { providerOptions: { zcodeUseManagedAcp: true, acpLaunchSpec: { command: "zcode-acp", env: { ZCODE_NATIVE_ENTRY: "custom.cjs" } } } } };
    const result = JSON.parse(resolveBridgeLine(JSON.stringify(request), f.root));
    assert.equal(result.params.providerOptions.acpLaunchSpec.command, next.executable);
    assert.equal(result.params.providerOptions.acpLaunchSpec.env.ZCODE_NATIVE_ENTRY, "custom.cjs");
    request.params.providerOptions.zcodeUseManagedAcp = false;
    assert.equal(JSON.parse(resolveBridgeLine(JSON.stringify(request), f.root)).params.providerOptions.acpLaunchSpec.command, "zcode-acp");
    request.params.providerOptions.zcodeUseManagedAcp = true;
    request.params = { options: { providerOptions: request.params.providerOptions } };
    assert.equal(JSON.parse(resolveBridgeLine(JSON.stringify(request), f.root)).params.options.providerOptions.acpLaunchSpec.command, next.executable);
  }
  assert.throws(() => selectAcp(f.root, path.join(f.root, "missing.exe")), /not found/);
  assert.equal(selectAcp(f.root, first.executable).source, "custom");
});

test("failed checksum, bad archive, wrong runtime and cancellation preserve the working version", async t => {
  const f = fixture(t);
  const first = await f.installer.install();
  for (const mode of ["checksum", "wrong-runtime"]) {
    f.setMode(mode); f.setVersion("0.3.2");
    await assert.rejects(f.installer.install(), mode === "checksum" ? /SHA-256 mismatch/ : /does not match/);
    assert.equal(managedInstallation(f.root).executable, first.executable);
  }
  f.setMode("ok");
  f.setZip(zipSync({ "../escape": Buffer.from("outside") }));
  await assert.rejects(f.installer.install(), /Unexpected file/);
  assert.equal(fs.existsSync(path.join(f.root, "escape")), false);
  await assert.rejects(f.installer.install({ signal: AbortSignal.abort() }), /abort/i);
  assert.equal(managedInstallation(f.root).executable, first.executable);
});

test("settings distinguish missing releases, assembling assets and network errors; cached checks can refresh", async t => {
  const f = fixture(t);
  f.setMode("none");
  let status = await f.installer.status({ refresh: true });
  assert.equal(status.latest, null); assert.equal(status.releaseError, null);
  f.setMode("pending");
  status = await f.installer.status({ refresh: true });
  assert.deepEqual(status.latest, { version: "0.3.1", ready: false });
  await assert.rejects(f.installer.install(), /not available yet/);
  f.setMode("ok");
  assert.equal((await f.installer.status({ refresh: true })).latest.ready, true);
  const count = f.fetches(); await f.installer.status(); assert.equal(f.fetches(), count);
  f.setMode("http");
  status = await f.installer.status({ refresh: true });
  assert.match(status.releaseError, /HTTP 503/);
});

test("the actual Rust release binary installs and runs after SHA-256 verification", async t => {
  const f = fixture(t);
  const real = resolveCommand(process.env.ZCODE_ACP_BIN || "zcode-acp");
  const { runJson } = await import("../scripts/native-cli.mjs");
  const info = await runJson(["--version"], { acpCommand: real });
  f.setVersion(info.version);
  f.setZip(zipSync({ [executable]: fs.readFileSync(real) }));
  const installer = createAcpInstaller({ dataDir: f.root, fetchImpl: f.fetchImpl });
  const installed = await installer.install();
  assert.equal((await installer.status()).current.version, info.version);
  assert.equal(selectAcp(f.root).executable, installed.executable);
});

test("verification uses the final executable path before activating the installation", async t => {
  const f = fixture(t);
  const first = await f.installer.install();
  f.setVersion("0.3.2");
  let verifiedPath;
  const installer = createAcpInstaller({ dataDir: f.root, fetchImpl: f.fetchImpl, run: async (_args, options) => {
    verifiedPath = options.acpCommand;
    assert.equal(managedInstallation(f.root).executable, first.executable);
    assert.match(path.basename(path.dirname(verifiedPath)), /^0\.3\.2-[a-f0-9-]+$/);
    assert.ok(fs.existsSync(verifiedPath));
    return { name: "zcode-acp", runtime: "rust", version: "0.3.2" };
  } });
  const next = await installer.install();
  assert.equal(next.executable, verifiedPath);
  assert.equal(managedInstallation(f.root).executable, verifiedPath);
});

test("the built BB bridge launches managed Rust for model discovery and thread construction", async t => {
  const f = fixture(t);
  const { runJson } = await import("../scripts/native-cli.mjs");
  const real = resolveCommand(process.env.ZCODE_ACP_BIN || "zcode-acp");
  f.setVersion((await runJson(["--version"], { acpCommand: real })).version);
  f.setZip(zipSync({ [executable]: fs.readFileSync(real) }));
  await createAcpInstaller({ dataDir: f.root, fetchImpl: f.fetchImpl }).install();
  const moduleUrl = new URL("../dist/host.js", import.meta.url).href;
  const script = `import readline from 'node:readline'; import { experimental_providerBridge as b } from ${JSON.stringify(moduleUrl)}; b.start({pluginId:'zcode',dataDir:process.env.TEST_ACP_ROOT,tempDir:process.env.TEST_ACP_ROOT}); const rl=readline.createInterface({input:process.stdin}); rl.on('line',line=>b.handleLine(line)); rl.on('close',()=>b.onClose?.());`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^ZCODE_|TOKEN|SECRET|API_KEY|CREDENTIAL/.test(key)));
  Object.assign(env, { TEST_ACP_ROOT: f.root, ZCODE_NODE: process.execPath, ZCODE_ACP_STATE_DIR: path.join(f.root, "state"), ZCODE_DATA_BASE_DIR: f.root });
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const closed = once(child, "close");
  const pending = new Map(); let id = 0, stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  readline.createInterface({ input: child.stdout }).on("line", line => {
    const result = JSON.parse(line), waiting = pending.get(result.id);
    if (waiting) { pending.delete(result.id); clearTimeout(waiting.timer); result.error ? waiting.reject(new Error(result.error.message)) : waiting.resolve(result.result); }
  });
  function request(method, params) {
    const key = ++id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Bridge timeout: ${method}; ${stderr}`)); }, 12000);
      pending.set(key, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: key, method, params }) + "\n");
    });
  }
  // Registered after fixture cleanup; Node runs after hooks in registration order.
  // Close explicitly before the fixture can remove an executable held on Windows.
  try {
    await request("initialize", { protocolVersion: 1, client: { name: "offline-test", version: "1" } });
    const providerOptions = { zcodeUseManagedAcp: true, acpLaunchSpec: { displayName: "ZCode CLI", command: "missing-acp-on-purpose", args: [], env: { ZCODE_NATIVE_ENTRY: fileURLToPath(new URL("./support/fake-native-server.mjs", import.meta.url)) } } };
    const models = await request("model/list", { cwd: f.root, providerOptions });
    assert.ok(JSON.stringify(models).includes("fixture"));
    const session = await request("thread/start", { threadId: "offline-managed-test", cwd: f.root, instructionMode: "replace", options: { providerOptions, permissionMode: "full", permissionScope: "full", approvalReviewer: null, permissionEscalation: null } });
    assert.ok(session.providerThreadId);
    await request("thread/stop", { threadId: "offline-managed-test", providerThreadId: session.providerThreadId, activeTurnId: null, intent: "release" });
  } finally {
    child.stdin.end();
    const kill = setTimeout(() => child.kill(), 4000);
    await closed; clearTimeout(kill);
    for (const item of pending.values()) clearTimeout(item.timer);
  }
});
