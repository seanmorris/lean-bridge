/** @file Exercise per-slot worker admission in real relocated PHP/Amp packages. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {isAbsolute,join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installPhpIOComponents} from "./php-io-install.mjs";
import {schedulerRepositories} from "./php-task-feed.mjs";

test("installed Composer packages enforce a separate callback allowance per slot and task",{timeout: 7200000},async t=>{
	const env=process.env,exes=JSON.parse(env.LEAN_BRIDGE_TEST_PHPS??'["/usr/bin/php"]');
	assert.ok(exes.length && exes.every(isAbsolute) && new Set(exes).size===exes.length);
	const scheduler=await schedulerRepositories(resolve(env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE));
	const work=await mkdtemp(join(tmpdir(),"php-native-budget-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_PHP_NATIVE_BUDGET_KEEP,replay=env.LEAN_BRIDGE_PHP_NATIVE_BUDGET_REPLAY;assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const output=resolve(env.LEAN_BRIDGE_PHP_NATIVE_BUDGET_OUTPUT??"build/php-native-budget");await mkdir(output,{recursive: true});
	const client=resolve("tests/fixtures/native-callback-budget/client.php");
	let ordinary,first;
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(sets,route);
		if(!replay) await buildNativeBudget({target: "php-native",work,set,route,ordinary});
		const stage=join(work,route),local=join(stage,"app"),deploy=join(stage,"moved");
		await mkdir(local,{recursive: true});await copyFile(client,join(local,"client.php"));
		const {components: [installed],vendor}=await installPhpIOComponents(stage,local,deploy,[set],scheduler);
		const {pkg,receiptSha256}=installed;assert.equal(pkg.profile,"native-php-task-v1");
		const json=async name=>JSON.parse(await readFile(join(vendor,pkg.name,"lean-bridge",name+".json")));
		const api=await json("binding-ir"),proof=await json("elaboration"),inner=await json("package-receipt");
		assert.equal(proof.selection.phpNativeCallbackBudgets,true);assert.equal(proof.selection.phpWasmCallbackBudgets,undefined);
		assert.equal(inner.bindingIrSha256,hashBindingIr(api));assert.equal(inner.runtimeIdentity,pkg.runtimeIdentity);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
			assert.equal(api.types.find(t=>t.id===p.type.id).callable.invocation,d.source.declaration==="Budget.probe" && p.name==="g"?"many":"once");
		const runtimeLibraries=Object.fromEntries(Object.entries(inner.files).filter(([key])=>/\/(?:libleanshared|liblean_bridge_native)\.so$/u.test(key)).map(([key,v])=>[key,v.sha256]));
		assert.equal(Object.keys(runtimeLibraries).length,2);
		if(route==="ordinary")
		{
			ordinary=api;assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.equal(proof.reviewedSourceSha256,sha256(canonicalJson(api)));assert.equal(api.documentation.summary,nativeBudgetReview);
			assert.deepEqual(api,{...ordinary,documentation: {...ordinary.documentation,summary: nativeBudgetReview}});
			assert.notEqual(pkg.artifacts[0].sha256,first.archive.sha256);assert.deepEqual(runtimeLibraries,first.runtimeLibraries);
		}
		const observations=[];
		for(const exe of exes)
		{
			const row=JSON.parse(await run(exe,["-n","-d","extension=ffi","-d","ffi.enable=1","client.php"],deploy,{...env,PATH: "/unavailable"},180000));
			assert.equal(row.races,16);assert.equal(row.live,0);assert.match(row.php,/^8\./u);observations.push(row);
		}
		assert.equal(new Set(observations.map(x=>x.php)).size,exes.length);
		const row={route
			, archive: pkg.artifacts[0]
			, runtimeLibraries
			, runtimeIdentity: pkg.runtimeIdentity
			, receiptSha256
			, bindingIrSha256: hashBindingIr(api)
			, sourceTreeSha256: proof.sourceTreeSha256
			, reviewedSourceSha256: proof.reviewedSourceSha256
			, clientSha256: sha256(await readFile(join(deploy,"client.php")))
			, observations};
		if(route==="ordinary") first=row;
		await writeFile(join(output,route+".json"),canonicalJson(row));await rm(stage,{recursive: true});
	}
	t.diagnostic("Handoffs: "+sets);
});
