import fs from "node:fs";
import path from "node:path";
import { resolveCommand } from "./native-cli.mjs";

export const RELEASES_URL = "https://github.com/ichinya/zcode-acp/releases";
export const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function buildTarget(platform = process.platform, arch = process.arch) {
  const target = { "win32-x64": "x86_64-pc-windows-msvc", "linux-x64": "x86_64-unknown-linux-gnu", "darwin-x64": "x86_64-apple-darwin", "darwin-arm64": "aarch64-apple-darwin" }[`${platform}-${arch}`];
  return target || null;
}

export function managedInstallation(dataDir) {
  if (!dataDir) return null;
  let current;
  try { current = JSON.parse(fs.readFileSync(path.join(dataDir, "acp", "current.json"), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw new Error("Cannot read installed ACP metadata"); }
  if (!VERSION.test(current.version) || !/^[\w.-]+$/.test(current.directory) || current.directory === "." || current.directory === ".." || current.target !== buildTarget()) throw new Error("Invalid installed ACP metadata");
  const executable = path.join(dataDir, "acp", "versions", current.directory, process.platform === "win32" ? "zcode-acp.exe" : "zcode-acp");
  return { version: current.version, executable };
}

// User override > plugin-managed installation > PATH. An explicit missing path fails.
/** @returns {{source: "custom" | "managed" | "path", executable: string}} */
export function selectAcp(dataDir, command = "", env = process.env) {
  if (command.trim()) return { source: "custom", executable: resolveCommand(command, env) };
  const installed = managedInstallation(dataDir);
  if (installed) return { source: "managed", executable: resolveCommand(installed.executable, env) };
  return { source: "path", executable: resolveCommand("zcode-acp", env) };
}

// Provider bridge and host RPC share the daemon's persistent plugin dataDir.
export function resolveBridgeLine(line, dataDir) {
  let request;
  try { request = JSON.parse(line); } catch { return line; }
  // Maintenance/model commands use params.providerOptions; thread/turn commands
  // carry the same declaration under params.options.providerOptions.
  const entries = [request?.params?.providerOptions, request?.params?.options?.providerOptions];
  for (const options of entries) {
    if (options?.zcodeUseManagedAcp !== true || !options.acpLaunchSpec) continue;
    const installed = managedInstallation(dataDir);
    if (installed) options.acpLaunchSpec.command = installed.executable;
  }
  return JSON.stringify(request);
}
