/**
 * Build genuine compiler-selected tasks, terminal errors and pull protocols.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const env=process.env, root=env.LEAN_BRIDGE_PHP_TASK_BUILD, target="php-native";
const json=async file=>JSON.parse(await readFile(file,"utf8"));
test("compile native PHP tasks and pull streams through the ordinary and reviewed author routes"
	,{skip: !root,timeout: 3_600_000},async t=>{
	const base=resolve("tests/fixtures/c-lean-tasks");
	for(const route of env.LEAN_BRIDGE_PHP_TASK_ROUTE ? [env.LEAN_BRIDGE_PHP_TASK_ROUTE] : ["ordinary","reviewed"])
	{
		assert.ok(["ordinary","reviewed"].includes(route));
		const dir=resolve(root,route), src=join(dir,"source"), out=join(dir,"handoff");
		await mkdir(src,{recursive: true});
		const copy=(f,n)=>copyFile(f,join(src,n),constants.COPYFILE_EXCL);
		const save=(n,b)=>writeFile(join(src,n),b,{flag: "wx"});
		await copy(join(base,"Pulse.lean"),"Pulse.lean");
		await copy(join(base,"lean-toolchain"),"lean-toolchain");
		await copy(resolve("tests/fixtures/ruby-task-lab/RubyTasks.lean"),"RubyTasks.lean");
		await save("lakefile.toml",(await readFile(join(base,"lakefile.toml"),"utf8"))+'\n[[lean_lib]]\nname="RubyTasks"\n');
		const cfg=await json(join(base,"lean-bridge.exports.json"));
		const scalars="unit bool uint8 int8 uint16 int16 uint32 int32 uint64 int64 usize isize char string bytes nat int float32 float64".split(" ").map(s=>"RubyTasks.rt_"+s);
		cfg.modules.push("RubyTasks"); cfg.exports.push(...scalars,"RubyTasks.wide","RubyTasks.terminal");
		cfg.taskExports.push(...scalars,"RubyTasks.wide","RubyTasks.terminal");
		cfg.taskIOErrors=["RubyTasks.terminal"]; cfg.targets={[target]: {name: "lean-bridge/pulse",version: "1.0.0"}};
		if(route==="reviewed")
		{
			delete cfg.exports;
			await copy(resolve(root,"ordinary/handoff/binding-ir.json"),"public.binding-ir.json");
		}
		await save("lean-bridge.exports.json",canonicalJson(cfg));
		await buildCanonicalProject({projectRoot: src,outputRoot: out,targets: [target],environment: env})
			.catch(e=>{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});});
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id,"native-php-task-v1");
		if(route==="reviewed") assert.deepEqual(await json(join(out,"binding-ir.json")),await json(join(src,"public.binding-ir.json")));
		t.diagnostic(route+": "+receipt.packages[0].artifacts[0].sha256);
	}}
);
