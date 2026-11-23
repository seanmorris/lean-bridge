/**
 * Replay real PHP callback archives, their compiled contracts and offline reproduction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generatePhpIOFiles } from "../../src/backends/php/io-package.mjs";
import { generatePhpIOPort } from "../../src/backends/php/io-port.mjs";
import { compilePhpTaskSurface } from "../../src/backends/php/io-surface.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { schedulerPackages } from "./php-task-feed.mjs";

const json=async p=>JSON.parse(await readFile(p,"utf8"));
const fx="tests/fixtures/php-retained-tasks";
/**
 * Verify the matrix, source ownership and independent package SHA, without regenerating observations.
 *
 * @param root - Root containing the two compiled projects and the installed-client results.
 * @param rebuilt - Native package rebuilt by an independent installed CLI.
 */
export const phpRetainedEvidence=async(root,rebuilt)=>{
	const packages={};
	for(const route of ["ordinary","reviewed"])
	{
		const h=join(root,route,"handoff"),base=join(h,"packages/php-native/composer");
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(h,"package-set-receipt.json")});
		const [pkg]=receipt.packages,profile="native-php-task-v1";
		assert.equal(pkg.profile,profile); assert.equal(pkg.name,"lean-bridge/retained");
		const api=await json(join(h,"binding-ir.json")),evidence=await json(join(h,"host-export-evidence.json"));
		const bindingIrSha256=hashBindingIr(api),input={name: pkg.name,version: pkg.version,api,evidence,bindingIrSha256};
		assert.equal(receipt.profiles[0].bindingIrSha256,bindingIrSha256);
		const model=compilePhpTaskSurface(input);
		for(const flags of [{phpTaskCallbacks: false},{rubyTaskCallbacks: true}])
		{
			const tampered=structuredClone(input); Object.assign(tampered.evidence.selection,flags);
			assert.throws(()=>compilePhpTaskSurface(tampered),/retained-callback/u);
		}
		const slotTypes=api.types.filter(t=>t.kind==="callback");
		for(const cb of slotTypes)
		{
			assert.equal(cb.callable.invocation,"many"); assert.equal(cb.callable.reentry,"same-agent");
			assert.equal(cb.callable.selfDisposal,"defer"); assert.deepEqual(cb.callable.failure.errors,["error:PhpCallbackException"]);
			assert.equal(cb.source.extensions["lean-bridge.dev/callback-scheduler"],"owner-event-loop");
		}
		const mutators=[
			d=>{ d.parameters[1].ownership="copy"; }
			, d=>{ d.parameters[1].lifetime.scope="call"; }
			, (_,t)=>{ t.callable.result.ownership="transfer"; }
			, (_,t)=>{ t.callable.failure.errors=["error:IO.Error"]; }
			, (_,t)=>{ t.callable.reentry="none"; }
		];
		for(const change of mutators)
		{
			const tampered=structuredClone(api),d=tampered.declarations.find(x=>x.name==="once");
			change(d,tampered.types.find(t=>t.id===d.parameters[1].type.id));
			assert.throws(()=>compilePhpTaskSurface({...input,api: tampered,bindingIrSha256: hashBindingIr(tampered)}));
		}
		const shape=model.methods.find(m=>m.name==="scalar_tour").callbacks;
		assert.deepEqual(shape.map(([slot])=>slot),Array.from({length: 19},(_,i)=>i));
		const port=generatePhpIOPort(model);
		assert.equal(port.source,await readFile(join(base,"lean-bridge/port.c"),"utf8"));
		assert.equal(port.header,await readFile(join(base,"lean-bridge/php-io-port.h"),"utf8"));
		const manifest=await json(join(base,"lean-bridge/package-receipt.json"));
		const {componentIdentity,runtimeIdentity,libraries}=manifest;
		const files=await generatePhpIOFiles(model,{componentId: api.component.id,componentIdentity,runtimeIdentity,libraries,library: "lib"+model.prefix+".so"});
		assert.ok(files["src/Internal/Callbacks.php"]);
		for(const [name,bytes] of Object.entries(files)) assert.equal(bytes,await readFile(join(base,name),"utf8"));
		const retainedExports=model.methods.filter(m=>m.callbacks).length;
		packages[route]={archive: pkg.artifacts[0],receiptSha256: result.receiptSha256,bindingIrSha256,retainedExports,scalarSlots: shape.length};
	}
	const runs=await json(join(root,"installed-retained-both.json"));
	assert.deepEqual(runs.scheduler,schedulerPackages); assert.deepEqual(Object.keys(runs.sources).sort(),["example.php","installed.php","shutdown.php"]);
	for(const [file,hash] of Object.entries(runs.sources)) assert.equal(sha256(await readFile(join(fx,file))),hash);
	const cells=[];
	for(const row of runs.reports)
	{
		assert.equal(row.receipt,packages[row.route].receiptSha256); assert.ok(row.checks>=55 && row.shutdown && row.example);
		assert.equal(row.fdDelta,0); assert.equal(row.live,0); cells.push(row.route+":"+row.php);
	}
	assert.deepEqual(cells.sort(),["ordinary:8.2.35","ordinary:8.5.10","reviewed:8.2.35","reviewed:8.5.10"]);
	const cli=await json(join(rebuilt,"reproduction.json"));
	const copy=await readVerifiedPackageSetReceipt({receiptPath: join(rebuilt,"handoff/package-set-receipt.json")});
	assert.equal(copy.result.receiptSha256,cli.receiptSha256); assert.deepEqual(copy.receipt.packages[0].artifacts,[cli.archive]);
	assert.equal(cli.receiptSha256,packages.ordinary.receiptSha256); assert.deepEqual(cli.archive,packages.ordinary.archive);
	return {profile: "native-php-task-v1",packages,...runs,offlineCLI: cli};
};
