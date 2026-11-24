/** @file Perl worker words belong to the interpreter, not to a JVM, Wasm store, or Lean-owned resource. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCTaskExports } from "../src/backends/c/task-exports.mjs";
import { generateSyncWire } from "../src/backends/c/sync-wire.mjs";
import { jvmWorkerKinds } from "../src/backends/jvm/host-members.mjs";
import { perlWorkerKinds } from "../src/backends/perl/host-members.mjs";

const ir=JSON.parse(await readFile(new URL("./fixtures/perl-host-project/lean-bridge.hosts.json",import.meta.url)));
const perlHostKinds=perlWorkerKinds(ir), [box]=perlHostKinds, obj={kind: "named",id: box.id};
const scalar={kind: "primitive",name: "uint32"}, parameters=[{name: "value",type: obj}];
const relay={name: "relay",declaration: "Jobs.relay",delivery: "task",effect: "BaseIO",taskIO: true
	, parameters: [...parameters,{name: "f",type: {kind: "io-callback",argument: obj,reply: obj}}],result: obj};
const result={kind: "apply",constructor: "result",arguments: [scalar,obj]};
const outcome={name: "outcome",declaration: "Jobs.outcome",delivery: "task",effect: "pure",parameters,result};
const options={name: "perl-worker",modules: ["Jobs"],entries: [relay,outcome],componentIdentity: "a".repeat(64)
	, integerMode: "words",perlDelivery: true,perlHostKinds};
test("a CPAN lease names the import contract and interpreter independently of the distribution",()=>{
	assert.deepEqual(perlWorkerKinds(structuredClone(ir)),perlHostKinds);
	const foreign=structuredClone(ir); foreign.types[0].host.targets=["jvm"];
	assert.throws(()=>perlWorkerKinds(foreign)); assert.notEqual(jvmWorkerKinds(foreign)[0].hash,box.hash);
	for(const change of [s=>{ s.component.version="2.0.0"; s.component.id=s.component.name+"@"+s.component.version; }
		,s=>s.types[0].resource.kindId+="2"])
	{
		const copy=structuredClone(ir); change(copy); assert.notEqual(perlWorkerKinds(copy)[0].hash,box.hash);
	}
});
test("only the native Perl task wire can carry class-valued callbacks and returned errors",()=>{
	const gen=generateCTaskExports(options), wire=generateSyncWire(gen.prefix,options.entries,{tasks: true,perlHostKinds});
	const t="host:"+box.hash;
	assert.match(gen.entryLean,/LeanBridge\.Host\.Perl\.Box/u);
	assert.deepEqual(wire.methods[0].callbacks,[[1,t,t]]);
	assert.deepEqual(wire.methods[1].result,["uint32",t]);
	assert.equal(wire.leases[0].tag,3); assert.equal(wire.leases[0].host,true);
	for(const change of [{perlDelivery: false},{integerMode: "gmp"},{jvmDelivery: true},{wasmTasks: true},{witCallbacks: true},{jvmHostKinds: perlHostKinds}])
		assert.throws(()=>generateCTaskExports({...options,...change}),/exclusive native Perl/u);
	for(const change of [{tasks: false},{wasmCallbacks: true},{witCallbacks: true},{jvmHostKinds: perlHostKinds}])
		assert.throws(()=>generateSyncWire(gen.prefix,options.entries,{tasks: true,perlHostKinds,...change}),/native Perl task wire/u);
});
