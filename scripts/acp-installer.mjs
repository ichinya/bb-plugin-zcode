import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { unzipSync } from "fflate";
import { buildTarget, managedInstallation, selectAcp, RELEASES_URL, VERSION } from "./managed-acp.mjs";
import { runJson } from "./native-cli.mjs";

const API = "https://api.github.com/repos/ichinya/zcode-acp/releases/latest";
const MAX_ARCHIVE = 64 * 1024 * 1024;
const installs = new Set();
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const message = error => error instanceof Error ? error.message : String(error);

export function createAcpInstaller({ dataDir, fetchImpl = fetch, run = runJson, platform = process.platform, arch = process.arch }) {
  const target = buildTarget(platform, arch);
  const binary = platform === "win32" ? "zcode-acp.exe" : "zcode-acp";
  let cachedRelease;
  let cachedAt = 0;

  async function download(url, limit, signal) {
    const response = await fetchImpl(url, { signal, headers: { Accept: url === API ? "application/vnd.github+json" : "application/octet-stream", "User-Agent": "bb-plugin-zcode" } });
    if (response.status === 404 && url === API) return null;
    if (!response.ok) throw new Error(`GitHub download failed (HTTP ${response.status})`);
    if (Number(response.headers.get("content-length")) > limit) throw new Error("Release download is too large");
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      signal?.throwIfAborted();
      size += chunk.length;
      if (size > limit) throw new Error("Release download is too large");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async function release(refresh, signal) {
    if (!refresh && cachedAt && Date.now() - cachedAt < 15 * 60_000) return cachedRelease;
    const bytes = await download(API, 2 * 1024 * 1024, signal);
    const value = bytes ? JSON.parse(bytes.toString("utf8")) : null;
    if (value && (value.draft || value.prerelease || typeof value.tag_name !== "string" || !value.tag_name.startsWith("v") || !VERSION.test(value.tag_name.slice(1)))) throw new Error("Unsupported ACP release; expected a stable vX.Y.Z tag");
    cachedRelease = value; cachedAt = Date.now();
    return value;
  }

  function assets(value) {
    if (!value || !target) return null;
    const name = `zcode-acp-${target}.zip`;
    const archive = value.assets?.find(asset => asset.name === name && asset.state === "uploaded");
    const checksum = value.assets?.find(asset => asset.name === `${name}.sha256` && asset.state === "uploaded");
    if (!archive || !checksum) return null;
    // Fixed repository, tag and filenames: never accept a user-supplied download URL.
    const prefix = `${RELEASES_URL}/download/${encodeURIComponent(value.tag_name)}/`;
    if (archive.browser_download_url !== prefix + name || checksum.browser_download_url !== prefix + name + ".sha256") throw new Error("Unexpected ACP release asset URL");
    return { name, archive, checksum };
  }

  /** @param {{acpCommand?: string, refresh?: boolean, signal?: AbortSignal}} options */
  async function status({ acpCommand = "", refresh = false, signal } = {}) {
    let current = null, currentError = null, selected = null;
    try {
      selected = selectAcp(dataDir, acpCommand);
      const info = await run(["--version"], { acpCommand: selected.executable, signal, timeout: 8_000 });
      if (info?.runtime !== "rust" || info?.name !== "zcode-acp" || !VERSION.test(info?.version)) throw new Error("Selected executable is not a supported Rust zcode-acp");
      current = { version: info.version, executable: selected.executable, source: selected.source };
    } catch (error) { currentError = message(error); }
    let latest = null, releaseError = null;
    try {
      const value = await release(refresh, signal);
      if (value) latest = { version: value.tag_name.slice(1), ready: Boolean(assets(value)) };
    } catch (error) { releaseError = message(error); }
    let managed = null;
    try { managed = managedInstallation(dataDir); } catch { /* currentError reports a broken default installation */ }
    return { target, current, currentError, managed, latest, releaseError, releasesUrl: RELEASES_URL };
  }

  /** @param {{signal?: AbortSignal}} options */
  async function install({ signal } = {}) {
    if (!target) throw new Error(`No ACP binary for ${platform}/${arch}`);
    if (installs.has(dataDir)) throw new Error("ACP installation is already running on this computer");
    installs.add(dataDir);
    let stage;
    try {
      const value = await release(true, signal);
      const files = assets(value);
      if (!files) throw new Error("ACP release binaries are not available yet. Wait for the release workflow to finish.");
      const checksumBytes = await download(files.checksum.browser_download_url, 1024, signal);
      const checksum = checksumBytes.toString("utf8").trim().split(/\s+/);
      if (checksum.length !== 2 || !/^[a-fA-F0-9]{64}$/.test(checksum[0]) || checksum[1] !== files.name) throw new Error("Invalid ACP SHA-256 file");
      const archive = await download(files.archive.browser_download_url, MAX_ARCHIVE, signal);
      if (digest(archive) !== checksum[0].toLowerCase()) throw new Error("ACP SHA-256 mismatch; existing installation was kept");
      const allowed = new Set([binary, "LICENSE", "NOTICE", "LICENSES/bb-zcode-MIT.txt"]);
      const contents = unzipSync(archive, { filter: entry => {
        if (!allowed.has(entry.name)) throw new Error("Unexpected file in ACP archive");
        if (entry.originalSize > (entry.name === binary ? MAX_ARCHIVE : 1024 * 1024)) throw new Error("ACP archive entry is too large");
        return true;
      } });
      if (!contents[binary]?.length || contents[binary].length > MAX_ARCHIVE) throw new Error("ACP archive has no executable");
      const root = path.join(dataDir, "acp");
      const versions = path.join(root, "versions");
      fs.mkdirSync(versions, { recursive: true });
      const version = value.tag_name.slice(1);
      const directory = `${version}-${randomUUID()}`;
      // Windows can keep a just-executed EXE's directory locked. Verify in its
      // final location; current.json activates it only after validation succeeds.
      stage = path.join(versions, directory);
      fs.mkdirSync(stage);
      for (const [name, bytes] of Object.entries(contents)) {
        const destination = path.join(stage, name);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, bytes, { mode: name === binary ? 0o755 : 0o644 });
      }
      const info = await run(["--version"], { acpCommand: path.join(stage, binary), signal, timeout: 8_000 });
      if (info?.runtime !== "rust" || info?.name !== "zcode-acp" || info?.version !== version) throw new Error("Downloaded ACP executable does not match the release version");
      signal?.throwIfAborted();
      const pointer = path.join(root, `current-${randomUUID()}.tmp`);
      try {
        fs.writeFileSync(pointer, JSON.stringify({ version, directory, target }), { mode: 0o600 });
        fs.renameSync(pointer, path.join(root, "current.json"));
      } finally { fs.rmSync(pointer, { force: true }); }
      stage = undefined;
      return { version, executable: path.join(versions, directory, binary) };
    } finally {
      installs.delete(dataDir);
      if (stage) await fs.promises.rm(stage, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
  return { status, install };
}
