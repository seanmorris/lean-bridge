/** @file CLR worker object labels cannot be substituted for copied values or another host's leases. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { taskWorkerInterface } from "../src/analyze/host-export-model.mjs";
import { generateCTaskExports } from "../src/backends/c/task-exports.mjs";
import { generateSyncWire } from "../src/backends/c/sync-wire.mjs";
import { dotnetWorkerKinds } from "../src/backends/dotnet/host-members.mjs";
import { rubyWorkerKinds } from "../src/backends/ruby/host-provider.mjs";

const source = JSON.parse(await readFile(new URL("./fixtures/ruby-host-meter/lean-bridge.hosts.json",import.meta.url)));
const ir = structuredClone(source);
for(const t of ir.types) t.host.targets = ["dotnet"];
const dotnetHostKinds = dotnetWorkerKinds(ir), [box] = dotnetHostKinds;
const obj = {kind: "named", id: box.id}, scalar = {kind: "primitive",name: "uint32"};
const parameters = [{name: "box", type: obj}, {name: "handler",type: {kind: "io-callback",argument: obj,reply: obj}}];
const relay={name: "relay",declaration: "Lab.relay",delivery: "task",effect: "BaseIO",taskIO: true,parameters,result: obj};
const result={kind: "apply",constructor: "result",arguments: [scalar,obj]};
const outcome={name: "outcome",declaration: "Lab.outcome",delivery: "task",effect: "pure",parameters: parameters.slice(0,1),result};
const options = {name: "clr-probe", modules: ["Lab"]
	, componentIdentity: "f".repeat(64), integerMode: "words"
	, dotnetDelivery: true, dotnetHostKinds, entries: [relay,outcome]};
test("CLR class transport binds its nominal coordinate and its runtime owner", () => {
	assert.deepEqual(dotnetWorkerKinds(structuredClone(ir)),dotnetHostKinds);
	assert.notEqual(box.hash,rubyWorkerKinds(source)[0].hash);
	assert.throws(() => dotnetWorkerKinds(source));
	for(const change of [v=>v.component.id+="2",v=>v.types[0].resource.kindId+="2"])
	{
		const other=structuredClone(ir); change(other); assert.notEqual(dotnetWorkerKinds(other)[0].hash,box.hash);
	}
	assert.throws(() => taskWorkerInterface({}, {selection: {dotnetTaskObjects: true}}), /JavaScript worker interface/u);
});
test("only the native CLR owner admits class-valued callbacks and nested worker results", () => {
	const gen=generateCTaskExports(options), wire=generateSyncWire(gen.prefix,options.entries,{tasks: true,dotnetHostKinds});
	const label="host:"+box.hash;
	assert.match(gen.entryLean,/LeanBridge\.Host\.Dotnet\.Box/u);
	assert.deepEqual(wire.methods[0].callbacks,[[1,label,label]]);
	assert.deepEqual(wire.methods[1].result,["uint32",label]);
	assert.equal(wire.leases[0].host,true);
	for(const change of [{dotnetDelivery: false},{integerMode: "gmp"},{rubyDelivery: true},{wasmCallbacks: true},{witCallbacks: true},{phpHostKinds: dotnetHostKinds}])
		assert.throws(() => generateCTaskExports({...options,...change}), /exclusive native CLR/u);
	for(const change of [{tasks: false},{wasmCallbacks: true},{witCallbacks: true},{phpHostKinds: dotnetHostKinds}])
		assert.throws(() => generateSyncWire(gen.prefix,options.entries,{tasks: true,dotnetHostKinds,...change}), /native CLR task wire/u);
});
