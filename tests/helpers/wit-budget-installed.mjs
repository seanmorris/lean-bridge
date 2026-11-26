/** @file Install the public pollable WIT budget world separately on both authoring routes. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,stat,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {isAbsolute,join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const digest=async path=>{
	const h=createHash("sha256");for await(const bytes of createReadStream(path)) h.update(bytes);return h.digest("hex");
};
test("installed WIT pollable tasks report a spent permit as a payload-free observation",{timeout: 7200000},async t=>{
	const env=process.env,work=await mkdtemp(join(tmpdir(),"wit-budget-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_WIT_BUDGET_KEEP,replay=env.LEAN_BRIDGE_WIT_BUDGET_REPLAY;assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const out=resolve(env.LEAN_BRIDGE_WIT_BUDGET_OUTPUT??"build/wit-budget");await mkdir(out,{recursive: true});
	const fixture=resolve("tests/fixtures/native-callback-budget");
	let ordinary,first,shared;
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(sets,route);if(!replay) await buildNativeBudget({target: "wit-wasi",work,set,route,ordinary});
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id,"native-wit-task-v1");assert.equal(receipt.packages.length,1);
		const [pkg]=receipt.packages,[archive]=pkg.artifacts;assert.equal(pkg.runtimeDelivery,"embedded");
		const tar=join(set,archive.path),stage=join(work,route),name=pkg.name+"-"+pkg.version+"-wit-wasi";
		await mkdir(stage);
		const paths=(await run("tar",["-tzf",tar],stage,env)).split("\n");assert.ok(paths.every(p=>p.startsWith(name+"/") && !p.split("/").includes("..")));
		await run("tar",["-xzf",tar],stage,env);const dest=join(stage,"relocated");await rename(join(stage,name),dest);
		const json=async f=>JSON.parse(await readFile(join(dest,f)));
		const manifest=await json("lean-bridge-package.json"),api=await json("share/lean-bridge/binding-ir.json"),proof=await json("share/lean-bridge/elaboration.json");
		assert.deepEqual(manifest.nativeEffects,[]);assert.equal(manifest.runtimeIdentity,pkg.runtimeIdentity);
		assert.equal(hashBindingIr(api),receipt.profiles[0].bindingIrSha256);assert.equal(proof.sourceTreeSha256,receipt.source.treeSha256);
		const runtimeLibraries={};
		for(const [f,v] of Object.entries(manifest.files))
		{
			assert.ok(!isAbsolute(f) && !f.split("/").includes(".."));const path=join(dest,f);
			assert.equal((await stat(path)).size,v.bytes);assert.equal(await digest(path),v.sha256);
			if(["lib/libleanshared.so","lib/liblean_bridge_native.so","lib/libwasmtime.so"].includes(f)) runtimeLibraries[f]=v.sha256;
		}
		assert.equal(Object.keys(runtimeLibraries).length,3);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
			assert.equal(api.types.find(t=>t.id===p.type.id).callable.invocation,d.source.declaration==="Budget.probe" && p.name==="g"?"many":"once");
		if(route==="ordinary")
		{
			ordinary=api;first=archive.sha256;shared=runtimeLibraries;assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.notEqual(archive.sha256,first);assert.deepEqual(shared,runtimeLibraries);
			assert.equal(await digest(join(dest,"share/lean-bridge/reviewed.binding-ir.json")),proof.reviewedSourceSha256);
			assert.equal(api.documentation.summary,nativeBudgetReview);
		}
		const component=join(dest,"component/budget.wasm"),world=join(dest,"wit/budget.wit");
		await run(env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",["component","targets",world,component],stage,env);assert.equal(await digest(component),manifest.componentSha256);
		const isolated={PATH: "/usr/bin:/bin",PKG_CONFIG_LIBDIR: join(dest,"lib/pkgconfig")};
		const flags=(await run("pkg-config",["--cflags","--libs","budget-wit"],stage,isolated)).match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
		const sources={};for(const f of ["wit-client.c","observer.h"])
		{
			await copyFile(join(fixture,f),join(stage,f));sources[f]=await digest(join(stage,f));
		}
		await run("cc",["-std=c11","-Wall","-Wextra","-Werror","wit-client.c",...flags,"-ldl","-o","consumer"],stage,isolated);
		const observation=await run(join(stage,"consumer"),[],stage,{PATH: "/no-author-tools",LEAN_NUM_THREADS: "4",RAYON_NUM_THREADS: "1"},180000);
		assert.equal(observation,"WIT pollable: 16 worker races; once, guest, typed, factory and terminal failures distinct; both owners destroyed; zero leases");
		const row={route,archive,sources,observation,runtimeLibraries
			, runtimeIdentity: pkg.runtimeIdentity
			, worldSha256: await digest(world)
			, componentSha256: manifest.componentSha256
			, executableSha256: await digest(join(stage,"consumer"))
			, receiptSha256: result.receiptSha256
			, bindingIrSha256: hashBindingIr(api)
			, sourceTreeSha256: proof.sourceTreeSha256
			, reviewedSourceSha256: proof.reviewedSourceSha256};
		await writeFile(join(out,route+".json"),canonicalJson(row));await rm(stage,{recursive: true});
	}
	t.diagnostic("Handoffs: "+sets);
});
