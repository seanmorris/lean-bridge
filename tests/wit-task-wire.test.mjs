/** @file Guard the private Wasmtime task delivery ABI independently of other schedulers. */
import assert from "node:assert/strict";
import test from "node:test";
import { generateCTaskExports } from "../src/backends/c/task-exports.mjs";
import { generateSyncWire } from "../src/backends/c/sync-wire.mjs";
import { renderWitTaskImports } from "../src/backends/wit/task-host.mjs";

const value={kind: "primitive",name: "uint32"};
const entry={name: "job",declaration: "Jobs.job",effect: "IO",delivery: "task"
	, parameters: [{name: "n",type: value}],result: value,taskIO: true};
const options={name: "jobs",modules: ["Jobs"],entries: [entry],componentIdentity: "a".repeat(64),integerMode: "words"};

test("WIT task errors use native readiness and stay distinct on the start and take wires",()=>{
	const generated=generateCTaskExports({...options,witDelivery: true});
	const wire=generateSyncWire(generated.prefix,options.entries,{tasks: true});
	const [method]=wire.methods;
	assert.equal(method.error,"string");assert.equal(method.terminal,"string");
	assert.equal(method.result,"uint32");assert.ok(method.names.poll);assert.ok(wire.wait.open);
	assert.equal(method.names.listen,undefined);assert.notEqual(method.names.start,method.names.take);
});

test("the WIT task and cursor wire cannot exchange demand, value, or failure channels",async ()=>{
	const primitive=name=>({kind: "primitive",name});
	const feed={name: "feed",declaration: "Jobs.feed",effect: "EIO"
		, delivery: "async-iterator",parameters: []
		, protocol: {open: "Jobs.feed",next: "Jobs.advance",close: "Jobs.finish"}
		, error: value,stepError: primitive("uint16")
		, result: {kind: "apply",constructor: "result",arguments: [primitive("int64"),primitive("string")]}};
	const entries=[entry,feed], generated=generateCTaskExports({...options,entries,witDelivery: true});
	const wire=generateSyncWire(generated.prefix,entries,{tasks: true});
	const [task,cursor]=wire.methods;
	assert.equal(task.names.pull,undefined); assert.ok(cursor.names.pull); assert.ok(cursor.names.poll);
	assert.equal(cursor.stepDeclaration,"Jobs.advance"); assert.equal(cursor.error,"uint32");
	assert.equal(cursor.terminal,"uint16"); assert.deepEqual(cursor.result,["int64","string"]);
	const methods=entries.map(e=>({declaration: e.declaration}));
	await assert.rejects(renderWitTaskImports({prefix: generated.prefix,wire,methods}),/method and native task wire disagree/u);
});

test("selecting WIT task delivery cannot also select a worker callback or a different scheduler",()=>{
	const withCallback={...entry,parameters: [{name: "f",type: {kind: "io-callback",argument: value,reply: value}}]};
	for(const override of [
		{entries: [withCallback]}, {integerMode: "gmp"}, {wasmTasks: true}
		, {cCallbacks: true}
		, {rustCallbacks: true}
		, {cppCallbacks: true}
		, {rubyDelivery: true}
		, {dotnetDelivery: true}
		, {jvmDelivery: true}
		, {perlDelivery: true}
		, {phpDelivery: true}
	]) assert.throws(()=>generateCTaskExports({...options,witDelivery: true,...override}),/WIT task delivery requires/u);
	assert.throws(()=>generateCTaskExports(options),/select exactly one host/u);
});

test("heap imports refuse missing, reordered or mistagged native lease kinds",async ()=>{
	const ticket="a".repeat(64), badge="b".repeat(64);
	const heap=[{hash: ticket},{hash: badge}];
	for(const leases of [[],[{hash: badge,tag: 3},{hash: ticket,tag: 4}],[{hash: ticket,tag: 3},{hash: badge,tag: 3}]])
		await assert.rejects(renderWitTaskImports({heap,wire: {leases}}),/heap identities and native leases disagree/u);
});
