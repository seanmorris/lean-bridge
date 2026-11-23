/**
 * Compile actual Lean worker callbacks through both PHP authoring routes.
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

const env={...process.env,LEAN_NUM_THREADS: "1"},root=env.LEAN_BRIDGE_PHP_RETAINED_BUILD;
const json=async p=>JSON.parse(await readFile(p,"utf8"));
test("compile worker callbacks with a source-authenticated PHP owner and exception identity",{skip: !root,timeout: 7_200_000},async t=>{
	for(const route of env.LEAN_BRIDGE_PHP_RETAINED_ROUTE?[env.LEAN_BRIDGE_PHP_RETAINED_ROUTE]:["ordinary","reviewed"])
	{
		assert.ok(["ordinary","reviewed"].includes(route));
		const src=resolve(root,route,"source"),out=resolve(root,route,"handoff");
		const shared=resolve("tests/fixtures/python-retained-tasks");
		await mkdir(src,{recursive: true});
		const cfg=await json(join(shared,"lean-bridge.exports.json"));
		const copy=(from,to)=>copyFile(from,join(src,to),constants.COPYFILE_EXCL);
		for(const name of ["lean-toolchain","Retained.lean"]) await copy(join(shared,name),name);
		await copy(resolve("tests/fixtures/ruby-retained-tasks/Feedback.lean"),"Feedback.lean");
		cfg.modules.push("Feedback");
		for(const key of ["exports","taskExports","taskIOErrors"]) cfg[key].push("Feedback.once","Feedback.early");
		cfg.targets={"php-native": {name: "lean-bridge/retained",version: "1.0.0"}};
		if(route==="reviewed")
		{
			delete cfg.exports;
			await copy(resolve(root,"ordinary/handoff/binding-ir.json"),"public.binding-ir.json");
		}
		await writeFile(join(src,"lean-bridge.exports.json"),canonicalJson(cfg),{flag: "wx"});
		await writeFile(join(src,"lakefile.toml"),'name="retained"\nversion="1.0.0"\n'+cfg.modules.map(m=>'[[lean_lib]]\nname="'+m+'"\n').join(""),{flag: "wx"});
		await buildCanonicalProject({projectRoot: src,outputRoot: out,targets: ["php-native"],environment: env})
			.catch(e=>{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});});
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id,"native-php-task-v1");
		const api=await json(join(out,"binding-ir.json")),proof=await json(join(out,"host-export-evidence.json"));
		assert.equal(proof.selection.phpTaskCallbacks,true);
		const decl=api.declarations.find(d=>d.name==="once"),arg=decl.parameters.find(p=>p.ownership==="lease");
		assert.equal(arg.lifetime.scope,"explicit");
		assert.deepEqual(decl.failure.errors,["error:TaskIO.Error","error:PhpCallbackException"]);
		assert.deepEqual(api.types.find(x=>x.id===arg.type.id).callable.failure.errors,["error:PhpCallbackException"]);
		if(route==="reviewed") assert.deepEqual(await json(join(src,"public.binding-ir.json")),api);
		t.diagnostic(route+": "+receipt.packages[0].artifacts[0].sha256);
	}
});
