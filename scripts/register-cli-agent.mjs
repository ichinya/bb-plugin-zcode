// Register this checkout as an ACP agent; preserve every other custom agent.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function bbEntry() {
  const candidates = [process.env.BB_CLI, ...(process.env.PATH || "").split(path.delimiter).flatMap(dir => [path.join(dir, "bb"), path.join(dir, "bb.exe")])].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (!fs.statSync(candidate).isFile()) continue;
      if (candidate.toLowerCase().endsWith(".exe")) return { command: candidate, args: [] };
      const fd = fs.openSync(candidate, "r"), prefix = Buffer.alloc(128);
      try { fs.readSync(fd, prefix, 0, prefix.length, 0); } finally { fs.closeSync(fd); }
      if (/^#![^\n]*\bnode\b/.test(prefix.toString("utf8")) || /\.[cm]?js$/i.test(candidate)) return { command: process.execPath, args: [candidate] };
    } catch { /* next official CLI location */ }
  }
  throw new Error("Set BB_CLI to BB's JavaScript CLI entry or executable");
}

const agent = {
  id: "zcode-cli", displayName: "ZCode CLI", command: process.env.ZCODE_ACP_BIN || "zcode-acp", args: [],
  env: {},
  permissionCli: { full: ["--bb-permission=full"], workspaceWrite: ["--bb-permission=accept-edits"] },
};
if (!process.argv.includes("--register")) {
  process.stdout.write(JSON.stringify({ providerId: "acp-zcode-cli", agent, nativeProvider: true, dryRun: true }, null, 2) + "\n");
} else {
  const launch = bbEntry();
  const run = args => execFileSync(launch.command, [...launch.args, ...args], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 2 * 1024 * 1024 });
  const config = JSON.parse(run(["plugin", "config", "provider-acp", "--json"]));
  const existing = JSON.parse(config.values?.customAgents || "[]");
  if (!Array.isArray(existing)) throw new Error("Existing ACP customAgents is not an array; no settings were changed");
  // The plugin now owns this stable provider ID and launches the Rust binary
  // directly. Remove only its obsolete custom-agent entry to avoid a collision.
  const agents = existing.filter(item => item.id !== agent.id);
  run(["plugin", "config", "provider-acp", "set", "customAgents", JSON.stringify(agents), "--json"]);
  process.stdout.write(JSON.stringify({ ok: true, providerId: "acp-zcode-cli", nativeProvider: true, removedLegacyCustomAgent: existing.some(item => item.id === agent.id), preservedOtherAgents: agents.length }) + "\n");
}
