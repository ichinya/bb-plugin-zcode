import { spawn, execFile } from "node:child_process";
import { resolveCommand } from "../scripts/native-cli.mjs";
// Launch glue only: ACP, authentication, sessions and quotas live in Rust.
try {
  const child = spawn(resolveCommand(), process.argv.slice(2), {
    stdio: "inherit", windowsHide: true, shell: false,
    env: { ...process.env },
  });
  const stop = signal => {
    if (!child.pid) return;
    if (process.platform === "win32") execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
    else child.kill(signal);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  child.on("error", () => { process.stderr.write("Cannot launch the zcode-acp executable\n"); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
} catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
