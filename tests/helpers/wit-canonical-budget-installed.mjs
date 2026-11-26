/** @file Run a downstream-owned callback provider and application against each relocated canonical release. */
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {canonicalBudgetGuest} from "./wit-canonical-budget-client.mjs";

test("canonical Budget futures preserve per-slot allowances, failure origin, reader-drop and guest owners after install",{timeout: 14400000},async t=>{
	const env=process.env,tools=env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools";
	const root=await mkdtemp(join(tmpdir(),"wit-canonical-budget-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_WIT_CANONICAL_BUDGET_KEEP,replay=env.LEAN_BRIDGE_WIT_CANONICAL_BUDGET_REPLAY;
	assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??root,"handoffs-"));
	const output=resolve(env.LEAN_BRIDGE_WIT_CANONICAL_BUDGET_OUTPUT??"build/wit-canonical-budget");
	await mkdir(output,{recursive: true});t.diagnostic("Handoffs: "+sets);
	const provider=await readFile(new URL("../fixtures/native-callback-budget/canonical-provider.wat",import.meta.url));
	const app=canonicalBudgetGuest();
	for(const [n,wat] of [["provider",provider],["application",app]])
	{
		await writeFile(join(root,n+".wat"),wat);await run(tools,["parse",n+".wat","-o",n+".wasm"],root,env);
		await run(tools,["validate","--features","cm-async,cm-async-builtins",n+".wasm"],root,env);
	}
	let ordinary,first;
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(sets,route);
		if(!replay)await buildNativeBudget({work: root,set,target: "wit-wasi",route,ordinary,canonical: true});
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		const [pkg]=receipt.packages,[archive]=pkg.artifacts,[profile]=receipt.profiles;
		assert.equal(pkg.name,"budget");assert.equal(profile.id,"native-wit-canonical-task-v1");assert.equal(profile.id,pkg.profile);
		const area=await mkdtemp(join(root,"install-")),installed=join(area,"relocated budget");
		await run("tar",["-xzf",join(set,archive.path),"--no-same-owner","--no-same-permissions"],area,env);
		await rename(join(area,basename(archive.path,".tar.gz")),installed);
		const read=n=>readFile(join(installed,n)),json=async n=>JSON.parse(await read(n));
		const manifest=await json("lean-bridge-package.json"),ir=await json("share/lean-bridge/binding-ir.json");
		assert.equal(manifest.bindingIrSha256,hashBindingIr(ir));assert.equal(manifest.bindingIrSha256,profile.bindingIrSha256);
		assert.equal(manifest.wasmtime.version,"51.0.0");assert.equal(manifest.runtimeIdentity,profile.runtimeIdentity);
		for(const [name,pin] of Object.entries(manifest.files))
{
			const bytes=await read(name);assert.deepEqual({bytes: bytes.length,sha256: sha256(bytes)},pin);
}
		if(route==="ordinary")
{ordinary=ir;first=archive.sha256;assert.equal(manifest.reviewedSourceSha256,undefined);}
		else
{
			assert.deepEqual(ir,{...ordinary,documentation: {...ordinary.documentation,summary: nativeBudgetReview}});
			assert.equal(manifest.reviewedSourceSha256,sha256(canonicalJson(ir)));assert.notEqual(archive.sha256,first);
}
		const cmd=join(installed,manifest.command);
		const value=await run(cmd,[join(root,"provider.wasm"),join(root,"application.wasm")],area,
			{PATH: "/no-author-tools",LEAN_NUM_THREADS: "2",RAYON_NUM_THREADS: "1",LANG: "C.UTF-8"});
		assert.equal(value,"27","independent guest checked all branches and sixteen two-worker races");
		const report={route,archive,value,wasmtime: manifest.wasmtime
			, receiptSha256: result.receiptSha256
			, bindingIrSha256: manifest.bindingIrSha256
			, runtimeIdentity: manifest.runtimeIdentity
			, reviewedSourceSha256: manifest.reviewedSourceSha256??null
			, sourceTreeSha256: receipt.source.treeSha256
			, commandSha256: sha256(await read(manifest.command))
			, worldSha256: sha256(await read(manifest.world))
			, providerSha256: sha256(await readFile(join(root,"provider.wasm")))
			, applicationSha256: sha256(await readFile(join(root,"application.wasm")))};
		await writeFile(join(output,route+".json"),canonicalJson(report));
		t.diagnostic(route+" "+archive.sha256+" — 27 checked futures, abandoned reader, no live native tasks or guest owners");
		await rm(area,{recursive: true});
	}
});
