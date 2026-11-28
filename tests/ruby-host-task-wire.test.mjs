/** @file Check that the MRI worker ABI authenticates its host and cannot be substituted for a Wasm owner. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {generateCTaskExports} from "../src/backends/c/task-exports.mjs";
import {generateSyncWire} from "../src/backends/c/sync-wire.mjs";
import {rubyWorkerKinds} from "../src/backends/ruby/host-provider.mjs";
import {taskWorkerInterface} from "../src/analyze/host-export-model.mjs";

const ir=JSON.parse(await readFile(new URL("./fixtures/ruby-host-meter/lean-bridge.hosts.json",import.meta.url)));
const rubyHostKinds=rubyWorkerKinds(ir), [box]=rubyHostKinds, obj={kind: "named",id: box.id};
const hash="a".repeat(64),parameters=[{name: "box",type: obj},{name: "f",type: {kind: "io-callback",argument: obj,reply: obj}}];
const opts={name: "rr",modules: ["Workshop"],componentIdentity: hash
	, entries: [{declaration: "Workshop.relay",name: "relay",delivery: "task",effect: "BaseIO",taskIO: true,parameters,result: obj}]
	, rubyDelivery: true,integerMode: "words",rubyHostKinds};

test("Ruby worker lease key follows the complete authored nominal coordinate",()=>{
	assert.deepEqual(rubyWorkerKinds(structuredClone(ir)),rubyHostKinds);
	for(const change of [x=>x.component.id+="2",x=>x.types[0].id+="2",x=>x.types[0].resource.kindId+="2"])
	{
		const altered=structuredClone(ir);change(altered);assert.notEqual(rubyWorkerKinds(altered)[0].hash,box.hash);
	}
	const wrong=structuredClone(ir);wrong.types[0].host.targets=["php"];
	assert.throws(()=>rubyWorkerKinds(wrong),/host classes/u);
});
test("only the MRI owner can compile Ruby worker objects, including nested callback carriers",()=>{
	const gen=generateCTaskExports(opts), wire=generateSyncWire(gen.prefix,opts.entries,{tasks: true,rubyHostKinds});
	assert.match(gen.entryLean,/LeanBridge\.Host\.Ruby\.Box/u);
	assert.deepEqual(wire.methods[0].callbacks,[[1,"host:"+box.hash,"host:"+box.hash]]);
	assert.equal(wire.leases[0].host,true); assert.equal(wire.leases[0].tag,3);
	assert.doesNotMatch(wire.source,/host_ticket/u);
	for(const extra of [{rubyDelivery: false},{integerMode: "gmp"},{phpDelivery: true},{wasmTasks: true,wasmCallbacks: true},{witCallbacks: true},{phpHostKinds: rubyHostKinds}])
		assert.throws(()=>generateCTaskExports({...opts,...extra}),/exclusive native Ruby/u);
	for(const extra of [{tasks: false},{wasmCallbacks: true},{witCallbacks: true},{phpHostKinds: rubyHostKinds}])
		assert.throws(()=>generateSyncWire(gen.prefix,opts.entries,{tasks: true,rubyHostKinds,...extra}),/native Ruby task wire/u);
	assert.throws(()=>generateCTaskExports({...opts,rubyHostKinds: [box,box]}),/lease layout/u);
	assert.throws(()=>taskWorkerInterface({}, {selection: {rubyTaskObjects: true}}),/JavaScript worker interface/u);
});
