import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createDesktopInstaller, parseDesktopRelease, parseDesktopManifest } from "../scripts/zcode-installer.mjs";
import { desktopCandidates, installedDesktop, nativeEnvironment } from "../scripts/zcode-installation.mjs";
import { resolveBridgeLine } from "../scripts/managed-acp.mjs";
import { withModelCatalog } from "../scripts/model-catalog.mjs";
import plugin from "../dist/server.js";

function writeVersion(resources, version) {
  const content = Buffer.from(JSON.stringify({ version }));
  const header = Buffer.from(JSON.stringify({ files: { "package.json": { offset: "0", size: content.length } } }));
  const paddedHeader = Buffer.alloc(Math.ceil(header.length / 4) * 4);
  header.copy(paddedHeader);
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(8 + paddedHeader.length, 4);
  prefix.writeUInt32LE(4 + paddedHeader.length, 8);
  prefix.writeUInt32LE(header.length, 12);
  fs.writeFileSync(path.join(resources, "app.asar"), Buffer.concat([prefix, paddedHeader, content]));
}

function fixture(t, platform = "linux") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zcode-desktop-"));
  t.after(() => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  const bytes = Buffer.from("official fixture archive");
  let version = "3.18.2";
  const target = `${{ linux: "linux", darwin: "macos", win32: "windows" }[platform]}-x64`;
  const calls = [], downloads = [];
  let corrupt = false;
  const env = { LOCALAPPDATA: path.join(root, "local-app-data"), ProgramFiles: path.join(root, "program-files") };
  const fetchImpl = async (url, options) => {
    options.signal?.throwIfAborted(); downloads.push(url);
    const name = `ZCode-${version}-${{ linux: "linux", darwin: "mac", win32: "win" }[platform]}-x64${{ linux: ".AppImage", darwin: ".zip", win32: ".exe" }[platform]}`;
    if (url.endsWith("/docs/install")) return new Response(`https://cdn-zcode.z.ai/zcode/electron/releases/${version}/${target}/${name}`);
    if (url.endsWith("latest.yml")) return new Response(`version: ${version}\nfiles:\n  - url: ${name}\n    sha512: ${createHash("sha512").update(bytes).digest("base64")}\n    size: ${bytes.length}\nreleaseNotes: |-\n  ignore this`);
    const downloaded = Buffer.from(bytes);
    if (corrupt) downloaded[0] ^= 1;
    return new Response(downloaded);
  };
  const run = async (command, args, options) => {
    calls.push({ command, args, options });
    if (command === "powershell.exe") return;
    const work = path.dirname(platform === "darwin" ? args[2] : command);
    const entry = platform === "linux" ? path.join(work, "squashfs-root/resources/glm/zcode.cjs") : platform === "darwin" ? path.join(args[3], "ZCode.app/Contents/Resources/glm/zcode.cjs") : path.join(env.LOCALAPPDATA, "Programs/ZCode/resources/glm/zcode.cjs");
    fs.mkdirSync(path.dirname(entry), { recursive: true }); fs.writeFileSync(entry, "unchanged official CLI");
    writeVersion(path.dirname(path.dirname(entry)), version);
  };
  const installer = createDesktopInstaller({ dataDir: root, platform, arch: "x64", fetchImpl, run, env });
  return { root, installer, env, calls, downloads, corrupt: () => { corrupt = true; }, setVersion: value => { version = value; }, fetchImpl, run };
}

test("official release selection uses the highest version for the requested platform, including two-digit minor versions", () => {
  const url = "https://cdn-zcode.z.ai/zcode/electron/releases/";
  assert.equal(parseDesktopRelease(`${url}3.9.1/linux-x64/file ${url}3.18.2/linux-x64/file ${url}9.0.0/windows-x64/file`, "linux-x64"), "3.18.2");
  assert.throws(() => parseDesktopRelease(`${url}3.18.2/windows-x64/file`, "linux-arm64"), /unavailable/);
  assert.throws(() => parseDesktopManifest("version: 3.18.2\nfiles:\n  - url: ../../bad.exe\n", "3.18.2", "win32", "x64"), /invalid_manifest/);
});

test("installation verifies the official checksum, persists a per-host pointer, deduplicates and reuses the installed copy", async t => {
  const f = fixture(t);
  f.installer.start({ signal: new AbortController().signal });
  f.installer.start({ signal: new AbortController().signal });
  const result = await f.installer.wait();
  assert.equal(result.phase, "installed"); assert.equal(result.version, "3.18.2");
  assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0].args, ["--appimage-extract"]);
  assert.equal(installedDesktop(f.root, "linux", {}), result.entry);
  assert.ok(fs.existsSync(result.entry));
  assert.ok(!fs.existsSync(f.calls[0].command), "download is removed after installation");
  f.installer.start({ signal: new AbortController().signal }); await f.installer.wait();
  assert.equal(f.downloads.length, 3, "existing ZCode is never downloaded or overwritten");
  assert.equal(fs.readFileSync(result.entry, "utf8"), "unchanged official CLI");
  assert.equal(createDesktopInstaller({ dataDir: f.root }).status().phase, "installed");
});

test("checksum failures and cancellation cannot execute or publish a package", async t => {
  const f = fixture(t); f.corrupt();
  f.installer.start({ signal: new AbortController().signal });
  const result = await f.installer.wait();
  assert.equal(result.phase, "failed"); assert.equal(result.error, "checksum_mismatch");
  assert.equal(f.calls.length, 0);
  assert.ok(!fs.existsSync(path.join(f.root, "zcode/current.json")));
  const cancelled = fixture(t);
  cancelled.installer.start({ signal: AbortSignal.abort() });
  assert.equal((await cancelled.installer.wait()).error, "interrupted");
  assert.equal(cancelled.calls.length, 0);
});

test("checking a new release never downloads it, and explicit updates keep the old CLI until verified", async t => {
  const f = fixture(t);
  const signal = new AbortController().signal;
  f.installer.start({ signal });
  const first = await f.installer.wait();
  f.setVersion("4.0.0");
  const checked = await f.installer.check("", true);
  assert.equal(checked.currentVersion, "3.18.2");
  assert.equal(checked.latestVersion, "4.0.0");
  assert.equal(checked.updateAvailable, true);
  assert.equal(checked.canUpdate, true);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.installer.check(first.entry)).canUpdate, false);
  f.installer.start({ signal, upgrade: true });
  assert.equal(installedDesktop(f.root, "linux", {}), first.entry);
  const updated = await f.installer.wait();
  assert.equal(updated.version, "4.0.0");
  assert.notEqual(updated.entry, first.entry);
  assert.equal(installedDesktop(f.root, "linux", {}), updated.entry);
  assert.ok(fs.existsSync(first.entry));
  f.setVersion("4.1.0"); f.corrupt();
  f.installer.start({ signal, upgrade: true });
  assert.equal((await f.installer.wait()).error, "checksum_mismatch");
  assert.equal(installedDesktop(f.root, "linux", {}), updated.entry);
});

test("the official model catalog is refreshed once per version and explicit overrides win", async t => {
  const f = fixture(t);
  f.installer.start({ signal: new AbortController().signal });
  const { entry } = await f.installer.wait();
  const configDir = path.join(path.dirname(path.dirname(entry)), "config/provider");
  fs.mkdirSync(configDir, { recursive: true });
  const catalog = (revision, ids) => ({ schemaVersion: 1, revision, config: {
    providerConfigRules: { providerRules: [{ providerId: "zai", config: { builtinModelIds: ids } }] },
    modelConfigRules: { modelRules: [] },
  } });
  fs.writeFileSync(path.join(configDir, "zcode-builtin.json"), JSON.stringify(catalog(1, ["GLM-5.3"])));
  const env = { ZCODE_NATIVE_ENTRY: entry };
  const remote = "https://cdn-zcode.z.ai/zcode/config/zcode-builtin-production.json";
  const urls = [];
  const fetchImpl = async url => {
    urls.push(String(url));
    if (String(url) === remote) return Response.json(catalog(2, ["GLM-5.4", "GLM-5.3"]));
    return Response.json({ code: 0, data: { configs: { builtin_provider_config_json: remote } } });
  };
  const catalogs = await Promise.all([withModelCatalog(f.root, env, fetchImpl), withModelCatalog(f.root, env, fetchImpl)]);
  assert.deepEqual(catalogs[0], catalogs[1]);
  assert.match(urls[0], /app_version=3\.18\.2/);
  const file = catalogs[0].ZCODE_BUILTIN_PROVIDER_CONFIG_FILE;
  assert.equal(JSON.parse(fs.readFileSync(file)).revision, 2);
  assert.equal((await withModelCatalog(f.root, env, fetchImpl)).ZCODE_BUILTIN_PROVIDER_CONFIG_FILE, file);
  const override = { ...env, ZCODE_BUILTIN_PROVIDER_CONFIG_FILE: "/explicit/custom.json" };
  assert.equal(await withModelCatalog(f.root, override, fetchImpl), override);
  assert.equal(urls.length, 2);
});

test("custom paths are authoritative; a missing override never causes another installation", async t => {
  const f = fixture(t);
  f.installer.start({ signal: new AbortController().signal, nativeEntry: path.join(f.root, "missing.cjs") });
  assert.equal((await f.installer.wait()).error, "custom_path_missing"); assert.equal(f.downloads.length, 0);
  const entry = path.join(f.root, "custom.cjs"); fs.writeFileSync(entry, "existing");
  f.installer.start({ signal: new AbortController().signal, nativeEntry: entry });
  assert.equal((await f.installer.wait()).entry, entry);
  assert.equal(f.downloads.length, 0); assert.equal(fs.readFileSync(entry, "utf8"), "existing");
});

test("Windows uses the official per-user installer and macOS extracts the official ZIP", async t => {
  for (const platform of ["win32", "darwin"]) {
    // macOS discovery checks the real /Applications; an installed ZCode is (correctly) reused there.
    if (platform === "darwin" && desktopCandidates("darwin").some(p => fs.existsSync(p))) { t.diagnostic("ZCode is installed on this Mac; the macOS ZIP path is covered on CI"); continue; }
    const f = fixture(t, platform);
    f.installer.start({ signal: new AbortController().signal });
    assert.equal((await f.installer.wait()).phase, "installed");
    if (platform === "win32") assert.deepEqual(f.calls.at(-1).args, ["/S", "/currentuser"]);
    else assert.equal(f.calls[0].command, "/usr/bin/ditto");
  }
});

test("an existing Windows ZCode is reused without running the installer or touching application files", async t => {
  const f = fixture(t, "win32");
  const entry = path.join(f.env.LOCALAPPDATA, "Programs/ZCode/resources/glm/zcode.cjs");
  fs.mkdirSync(path.dirname(entry), { recursive: true }); fs.writeFileSync(entry, "existing ZCode");
  f.installer.start({ signal: new AbortController().signal });
  assert.equal((await f.installer.wait()).entry, entry);
  assert.equal(f.downloads.length, 0); assert.equal(f.calls.length, 0);
  assert.equal(fs.readFileSync(entry, "utf8"), "existing ZCode");
});

test("a restarted worker exposes an interrupted job with a retry instead of a permanently busy button", async t => {
  const f = fixture(t); const root = path.join(f.root, "zcode");
  fs.mkdirSync(root); fs.writeFileSync(path.join(root, "install.json"), JSON.stringify({ phase: "downloading", downloaded: 0, total: 10, version: "3.18.2", entry: null, error: null }));
  const restarted = createDesktopInstaller({ dataDir: f.root });
  assert.equal(restarted.status().phase, "failed"); assert.equal(restarted.status().error, "interrupted");
});

test("the selected host's managed Desktop reaches chat/model/health even with a custom ACP binary", async t => {
  const f = fixture(t);
  f.installer.start({ signal: new AbortController().signal }); const result = await f.installer.wait();
  const environment = nativeEnvironment(f.root, "", {}, "linux");
  assert.equal(environment.ZCODE_NATIVE_ENTRY, result.entry);
  assert.equal(environment.ZCODE_NODE, process.execPath);
  assert.equal(nativeEnvironment(f.root, "/explicit/missing.cjs", {}, "linux").ZCODE_NATIVE_ENTRY, "/explicit/missing.cjs");
  // The fixture pointer belongs to this test's actual platform for bridge resolution.
  if (process.platform === "linux") for (const method of ["model/list", "provider/health", "thread/start", "turn/start"]) {
    const options = { zcodeUseManagedAcp: false, acpLaunchSpec: { command: "/custom/acp", env: {} } };
    const params = method.includes("start") ? { options: { providerOptions: options } } : { providerOptions: options };
    const value = JSON.parse(resolveBridgeLine(JSON.stringify({ method, params }), f.root));
    const launch = (value.params.options?.providerOptions || value.params.providerOptions).acpLaunchSpec;
    assert.equal(launch.command, "/custom/acp"); assert.equal(launch.env.ZCODE_NATIVE_ENTRY, result.entry);
  }
});

test("settings installation and status are routed to the requested connected computer", async () => {
  let handlers; const calls = [];
  await plugin({
    settings: { define: () => ({ get: async () => ({ nativeEntry: "/custom/path.cjs" }), onChange() {} }) },
    providers: { register: () => ({ dispose() {} }) }, onDispose() {},
    sdk: {
      hosts: { list: async () => [{ id: "chosen", type: "persistent", status: "connected" }, { id: "offline", type: "persistent", status: "disconnected" }] },
      providers: { models: async ({ hostId, preferCached }) => { calls.push({ method: "models", hostId, preferCached }); } },
    },
    hosts: { experimental_client: ({ contract }) => ({ call: async (method, input, options) => { contract[method].input.parse(input); calls.push({ method, input, hostId: options.hostId }); return {}; } }) },
    rpc: { register: (_contract, callbacks) => { if (callbacks["zcode.install"]) handlers = callbacks; } },
  });
  await handlers["zcode.install"]({ hostId: "chosen" });
  await handlers["zcode.installStatus"]({ hostId: "chosen" });
  assert.deepEqual(calls, [{ method: "desktopInstall", input: { nativeEntry: "/custom/path.cjs" }, hostId: "chosen" }, { method: "desktopInstallStatus", input: { nativeEntry: "/custom/path.cjs" }, hostId: "chosen" }]);
  await assert.rejects(handlers["zcode.install"]({ hostId: "offline" }), /connected computer/);
  assert.equal(calls.length, 2);
  await handlers["zcode.refreshModels"]({ hostId: "chosen" });
  assert.deepEqual(calls.at(-1), { method: "models", hostId: "chosen", preferCached: false });
});
