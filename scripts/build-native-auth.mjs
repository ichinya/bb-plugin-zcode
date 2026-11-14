// Compatibility check command. Build the native executable in its own repo.
import { runJson } from "./native-cli.mjs";
const runtime = await runJson(["runtime-info"], { timeout: 8_000 });
if (runtime?.runtime !== "rust" || runtime?.schemaVersion !== 1) throw new Error("Install the Rust zcode-acp executable (0.3+) first");
process.stdout.write(JSON.stringify(runtime) + "\n");
