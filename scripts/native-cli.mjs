import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

// An explicit path is authoritative. Never interpret a shell command line.
export function resolveCommand(command = process.env.ZCODE_ACP_BIN || "zcode-acp", env = process.env) {
  const value = command.trim();
  if (!value || /[\0\r\n]/.test(value)) throw new Error("Invalid zcode-acp executable");
  const explicit = path.isAbsolute(value) || /[/\\]/.test(value);
  const names = process.platform === "win32" && !path.extname(value) ? [value + ".exe"] : [value];
  const candidates = explicit ? names.map(name => path.resolve(name)) : (env.PATH || "").split(path.delimiter).filter(Boolean).flatMap(dir => names.map(name => path.join(dir, name)));
  for (const candidate of candidates) {
    try {
      if (!fs.statSync(candidate).isFile()) continue;
      fs.accessSync(candidate, process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
      return candidate;
    } catch { /* next PATH directory */ }
  }
  throw new Error("zcode-acp executable not found. Add it to PATH or set ACP executable in the ZCode plugin settings.");
}
/** @param {string[]} args
 * @param {{acpCommand?: string, nativeEntry?: string, signal?: AbortSignal, timeout?: number}} options
 * @returns {Promise<unknown>} */
export function runJson(args, { acpCommand, nativeEntry, signal, timeout = 40_000 } = {}) {
  const env = { ...process.env, ...(nativeEntry ? { ZCODE_NATIVE_ENTRY: nativeEntry } : {}) };
  let command;
  try { command = resolveCommand(acpCommand || env.ZCODE_ACP_BIN || "zcode-acp", env); }
  catch (error) { return Promise.reject(error); }
  return new Promise((resolve, reject) => {
    execFile(command, [...args, "--json"], { env, signal, timeout, windowsHide: true, maxBuffer: 2 * 1024 * 1024, encoding: "utf8", shell: false }, (error, stdout) => {
      if (error) return reject(new Error("zcode-acp command failed, was cancelled or timed out"));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error("zcode-acp returned invalid JSON")); }
    });
  });
}
