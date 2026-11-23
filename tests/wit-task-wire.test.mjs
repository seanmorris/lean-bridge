/** @file Guard the private Wasmtime task delivery ABI independently of other schedulers. */
import assert from "node:assert/strict";
import test from "node:test";
import { generateCTaskExports } from "../src/backends/c/task-exports.mjs";
import { generateSyncWire } from "../src/backends/c/sync-wire.mjs";

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
