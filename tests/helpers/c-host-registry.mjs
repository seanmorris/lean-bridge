/** @file Compile and run the native C application reference ownership checks. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
const run=promisify(execFile);
test("C application references reject stale, foreign and wrong-kind owners",async t=>{
	const root=await mkdtemp(join(tmpdir(),"c-host-registry-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const kit=resolve("src/backends/c"),bin=join(root,"app");
	await run(process.env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror","-O1","-pthread","-DLB_C_REF_PREFIX=checked_","-I"+kit,join(kit,"host-registry.c"),resolve("tests/fixtures/c-host-members/registry.c"),"-o",bin]);
	assert.match((await run(bin,[],{cwd: root})).stdout,/two exact destructions/u);
});
