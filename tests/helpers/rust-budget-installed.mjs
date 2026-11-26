/** @file Exercise per-registration callback admission through the public installed Cargo crate. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {buildNativeBudget,nativeBudgetReview} from "./native-budget-handoff.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installRustHostApp} from "./rust-host-installed-app.mjs";

test("offline Cargo clients distinguish a worker admission refusal from an original Rust error",{timeout: 7200000},async t=>{
	const env=process.env,work=await mkdtemp(join(tmpdir(),"cargo-budget-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const keep=env.LEAN_BRIDGE_CARGO_BUDGET_KEEP,replay=env.LEAN_BRIDGE_CARGO_BUDGET_REPLAY;assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const output=resolve(env.LEAN_BRIDGE_CARGO_BUDGET_OUTPUT??"build/cargo-budget");await mkdir(output,{recursive: true});
	const source=resolve("tests/fixtures/native-callback-budget/client.rs");
	t.diagnostic("Handoffs: "+sets);let ordinary,first,shared;
	for(const route of ["ordinary","reviewed"])
	{
		const out=join(sets,"cargo",route);
		if(!replay) await buildNativeBudget({work,set: out,target: "cargo",route,ordinary});
		const {result,receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,["native-rust-task-v1"]);assert.equal(receipt.packages.length,2);
		const component=receipt.packages.find(p=>p.role==="component"),runtime=receipt.packages.find(p=>p.role==="runtime");
		assert.equal(component.name,"cargo-budget");assert.equal(runtime.name,"lean-bridge-task-runtime");
		assert.equal(component.runtimeIdentity,runtime.runtimeIdentity);assert.equal(component.requires[0].version,runtime.version);
		assert.equal(component.artifacts.length,1);assert.equal(runtime.artifacts.length,1);
		const archive=component.artifacts[0],runtimeArchive=runtime.artifacts[0];
		const metadata=async name=>JSON.parse(await run("tar",["-xOzf",join(out,archive.path),"--wildcards","*/lean-bridge/"+name+".json"],work,env));
		const api=await metadata("binding-ir"),proof=await metadata("elaboration");
		assert.equal(hashBindingIr(api),receipt.profiles[0].bindingIrSha256);
		assert.equal(proof.sourceTreeSha256,receipt.source.treeSha256);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
		{
			const type=api.types.find(t=>t.id===p.type.id);
			assert.equal(type.callable.invocation,d.source.declaration==="Budget.probe" && p.name==="g"?"many":"once");
		}
		if(route==="ordinary")
		{
			ordinary=api;first=archive.sha256;shared=runtimeArchive;assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.equal(proof.reviewedSourceSha256,sha256(canonicalJson(api)));assert.equal(api.documentation.summary,nativeBudgetReview);
			assert.notEqual(archive.sha256,first);assert.deepEqual(runtimeArchive,shared);
		}
		const app=await installRustHostApp({root: work,out,receipt,worker: true,env,source,component: component.name,preserveHandoff: true});
		const clientSha256=sha256(await readFile(join(app.src,"src/main.rs")));
		assert.equal(clientSha256,sha256(await readFile(source)));
		const isolated=await app.isolate();
		const observation=await run(app.bin,[],app.runtime,{...isolated,LEAN_NUM_THREADS: "4"});
		assert.equal(observation,"Rust: one-call admission; 16 worker races; original and replacement errors distinguished; capture released; zero leases");
		const row={route,archive,runtimeArchive,observation
			, receiptSha256: result.receiptSha256,bindingIrSha256: hashBindingIr(api)
			, runtimeIdentity: runtime.runtimeIdentity
			, sourceTreeSha256: proof.sourceTreeSha256
			, reviewedSourceSha256: proof.reviewedSourceSha256
			, clientSha256};
		await writeFile(join(output,route+".json"),canonicalJson(row));await rm(app.temp,{recursive: true});
	}
});
