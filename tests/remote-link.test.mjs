import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseRemoteLink } from "../lib/remote-link.mjs";

const fixture = "https://zcode.z.ai/remote/v4?sid=synthetic-session&mid=synthetic-device&name=Test&app_version=3.17.2";
test("remote parser preserves the versioned official QR link", () => {
  const link = parseRemoteLink(" " + fixture + "\n");
  assert.equal(link.url, fixture);
  assert.equal(link.appVersion, "3.17.2");
  assert.equal(link.controls, "existing-desktop-window");
});
for (const link of [
  fixture.replace("https:", "http:"), fixture.replace("zcode.z.ai", "zcode.z.ai.attacker.example"),
  fixture.replace("https://", "https://user:pass@"), fixture.replace("/v4", "/v3"),
  fixture.replace("&app_version=3.17.2", ""), fixture + "&mid=duplicate", fixture + "#secret", fixture + "&t=legacy-secret",
]) test("remote parser rejects unsupported links without echoing identifiers", () => {
  assert.throws(() => parseRemoteLink(link), error => !error.message.includes("synthetic-session") && !error.message.includes("legacy-secret"));
});

test("remote CLI validates a link file without launching a browser or printing pairing IDs", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zcode-remote-fixture-"));
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "link.txt");
  fs.writeFileSync(file, fixture);
  const command = fileURLToPath(new URL("../bin/zcode-connect.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [command, "remote", "--link-file", file], { encoding: "utf8" });
  const info = JSON.parse(output);
  assert.equal(info.appVersion, "3.17.2");
  assert.equal(info.browserLaunchRequested, false);
  assert.equal(info.pairingVerified, false);
  assert.equal(output.includes("synthetic-session"), false);
  assert.equal(output.includes("synthetic-device"), false);
});
