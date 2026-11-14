import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveCommand, runJson } from "../scripts/native-cli.mjs";
test("resolves PATH commands and explicit paths with spaces without shell expansion", t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"zcode cli path-"));
  t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});
  const exe=path.join(root,`zcode-acp${process.platform==="win32"?".exe":""}`);
  fs.writeFileSync(exe,""); fs.chmodSync(exe,0o700);
  assert.equal(resolveCommand("zcode-acp",{PATH:root}),exe);
  assert.equal(resolveCommand(exe,{PATH:""}),exe);
  assert.throws(()=>resolveCommand(path.join(root,"missing"),{PATH:root}),/not found/);
  assert.throws(()=>resolveCommand("bad\ncommand",{PATH:root}),/Invalid/);
});
test("native CLI JSON commands support a user path and cancellation",async()=>{
  const runtime=await runJson(["runtime-info"]);
  assert.equal(runtime.runtime,"rust");assert.equal(runtime.schemaVersion,1);
  assert.equal((await runJson(["runtime-info"],{acpCommand:runtime.cliPath})).runtime,"rust");
  const signal=AbortSignal.abort();await assert.rejects(runJson(["inventory"],{signal}),/cancelled/);
});
