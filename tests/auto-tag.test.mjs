import assert from "node:assert/strict";
import test from "node:test";
import { createVersionTag, releaseTag } from "../scripts/auto-tag.mjs";

const sha = "a".repeat(40);
const manifest = { version: "0.1.0" };
const lock = { version: "0.1.0", packages: { "": { version: "0.1.0" } } };
function setup(responses) {
  const calls = [];
  return {
    calls,
    run: () => createVersionTag({ manifest, lock, repository: "owner/plugin", sha, request: async (...args) => {
      calls.push(args);
      assert.ok(responses.length, "unexpected API mutation/request");
      return responses.shift();
    } }),
  };
}
const main = () => ({ status: 200, data: { object: { sha } } });

test("creates v0.1.0 for the verified main commit", async () => {
  const fixture = setup([main(), { status: 404 }, { status: 201 }]);
  assert.deepEqual(await fixture.run(), { tag: "v0.1.0", status: "created" });
  assert.deepEqual(fixture.calls.at(-1), ["POST", "/repos/owner/plugin/git/refs", { ref: "refs/tags/v0.1.0", sha }]);
});
test("an existing tag stays immutable even when it points to an earlier commit", async () => {
  const fixture = setup([main(), { status: 200, data: { object: { sha: "b".repeat(40) } } }]);
  assert.equal((await fixture.run()).status, "already-exists");
  assert.ok(fixture.calls.every(([method]) => method === "GET"));
});
test("an old CI run cannot tag a newer main", async () => {
  const fixture = setup([{ status: 200, data: { object: { sha: "b".repeat(40) } } }]);
  assert.equal((await fixture.run()).status, "skipped-stale-main");
  assert.equal(fixture.calls.length, 1);
});
test("concurrent tag creation is idempotent", async () => {
  const fixture = setup([main(), { status: 404 }, { status: 422 }, { status: 200 }]);
  assert.equal((await fixture.run()).status, "already-exists");
  assert.equal(fixture.calls.filter(([method]) => method === "POST").length, 1);
});
test("API authorization failures and genuine creation errors fail CI", async () => {
  for (const responses of [[{ status: 403 }], [main(), { status: 403 }], [main(), { status: 404 }, { status: 422 }, { status: 404 }]]) {
    await assert.rejects(setup(responses).run(), /HTTP (403|422)/);
  }
});
test("only stable versions matching both lockfile versions can be tagged", () => {
  assert.equal(releaseTag(manifest, lock), "v0.1.0");
  for (const version of ["0.1", "01.1.0", "0.1.0-beta.1", "0.1.0/path"]) {
    assert.throws(() => releaseTag({ version }, lock), /stable/);
  }
  assert.throws(() => releaseTag(manifest, { ...lock, version: "0.4.0" }), /differ/);
  assert.throws(() => releaseTag(manifest, { ...lock, packages: { "": { version: "0.4.0" } } }), /differ/);
});
