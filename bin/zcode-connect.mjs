import { spawn } from "node:child_process";
import fs from "node:fs";
import { parseRemoteLink } from "../lib/remote-link.mjs";

const [mode, ...args] = process.argv.slice(2);
try {
  if (mode === "local" && !args.length) {
    await import("./zcode-native-acp.mjs");
  } else if (mode === "remote") {
    const fileIndex = args.indexOf("--link-file");
    const file = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
    if (!file || args.some((arg, i) => i !== fileIndex && i !== fileIndex + 1 && arg !== "--open")) throw new Error("Usage: node bin/zcode-connect.mjs remote --link-file PATH [--open]");
    const link = parseRemoteLink(fs.readFileSync(file, "utf8"));
    if (args.includes("--open")) {
      let command, argv;
      if (process.platform === "win32") { command = "rundll32.exe"; argv = ["url.dll,FileProtocolHandler", link.url]; }
      else if (process.platform === "darwin") { command = "/usr/bin/open"; argv = [link.url]; }
      else throw new Error("Opening the remote client is supported on Windows and macOS");
      await new Promise((resolve, reject) => {
        const child = spawn(command, argv, { stdio: "ignore", windowsHide: true });
        child.on("error", () => reject(new Error("Could not open the official remote client")));
        child.on("exit", code => code === 0 ? resolve() : reject(new Error("Browser launcher failed")));
      });
    }
    // Pairing identifiers and the complete link deliberately stay out of stdout.
    const { url, ...info } = link;
    process.stdout.write(JSON.stringify({ ...info, browserLaunchRequested: args.includes("--open"), pairingVerified: false }) + "\n");
  } else {
    process.stderr.write("Usage:\n  node bin/zcode-connect.mjs local\n  node bin/zcode-connect.mjs remote --link-file PATH [--open]\n");
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write((mode === "remote" ? "Remote connection failed: " : "ZCode connection failed: ") + error.message + "\n");
  process.exitCode = 1;
}
