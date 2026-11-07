import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repository = "ichinya/zcode-acp";
export function modulePin(manifest) {
  const value = manifest.dependencies?.["zcode-acp"] ?? "";
  const match = /^git\+https:\/\/github\.com\/ichinya\/zcode-acp\.git#([a-f0-9]{40})$/.exec(value);
  if (!match) throw new Error("zcode-acp must be pinned to a full commit in ichinya/zcode-acp");
  return match[1];
}

export function moduleGitEnvironment(checkout) {
  const key = `url.${pathToFileURL(path.resolve(checkout, ".git")).href}.insteadOf`;
  const entries = [
    [key, `https://github.com/${repository}.git`],
    [key, `ssh://git@github.com/${repository}.git`],
    [key, `git@github.com:${repository}.git`],
    ["protocol.file.allow", "always"],
  ];
  return Object.fromEntries([
    ["GIT_CONFIG_COUNT", String(entries.length)],
    ...entries.flatMap(([key, value], i) => [[`GIT_CONFIG_KEY_${i}`, key], [`GIT_CONFIG_VALUE_${i}`, value]]),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const pin = modulePin(JSON.parse(readFileSync("package.json", "utf8")));
  if (process.argv[2] === "pin") {
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${pin}\n`);
  } else if (process.argv[2] === "configure") {
    const checkout = path.resolve(".ci-zcode-acp");
    const head = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (head !== pin) throw new Error("ACP checkout does not match package.json");
    const env = moduleGitEnvironment(checkout);
    appendFileSync(process.env.GITHUB_ENV, Object.entries(env).map(([k, v]) => `${k}=${v}\n`).join(""));
    console.log(`npm will use the local ACP checkout at ${pin}`);
  } else {
    throw new Error("Usage: node scripts/ci-module.mjs pin|configure");
  }
}
