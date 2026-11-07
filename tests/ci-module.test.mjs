import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { modulePin, moduleGitEnvironment } from "../scripts/ci-module.mjs";

test("CI accepts only the expected ACP repository at an immutable revision", () => {
  const pin = "a".repeat(40);
  const manifest = value => ({ dependencies: { "zcode-acp": value } });
  assert.equal(modulePin(manifest(`git+https://github.com/ichinya/zcode-acp.git#${pin}`)), pin);
  for (const url of ["main", "git+https://github.com/ichinya/zcode-acp.git#main", `git+https://github.com/other/module.git#${pin}`]) {
    assert.throws(() => modulePin(manifest(url)), /pinned/);
  }
});

test("Git resolves all npm URL forms from a local checkout with spaces without credentials", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zcode-ci space-"));
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (args, env = process.env) => execFileSync("git", args, { env, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
  git(["init", "--initial-branch=main", root]);
  git(["-C", root, "-c", "user.name=CI fixture", "-c", "user.email=ci@example.invalid", "commit", "--allow-empty", "-m", "fixture"]);
  const head = git(["-C", root, "rev-parse", "HEAD"]);
  const env = { ...process.env, ...moduleGitEnvironment(root), GIT_TERMINAL_PROMPT: "0" };
  for (const url of ["https://github.com/ichinya/zcode-acp.git", "ssh://git@github.com/ichinya/zcode-acp.git", "git@github.com:ichinya/zcode-acp.git"]) {
    assert.equal(git(["ls-remote", url, "refs/heads/main"], env).split(/\s+/)[0], head);
  }
});
