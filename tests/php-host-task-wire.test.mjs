/** @file Reject mixed host owners at every native PHP task-code generation boundary. */
import assert from "node:assert/strict";
import test from "node:test";
import {generateCTaskExports} from "../src/backends/c/task-exports.mjs";
import {generateSyncWire} from "../src/backends/c/sync-wire.mjs";
import {generatePhpIOPort} from "../src/backends/php/io-port.mjs";

const hash="a".repeat(64),id="host:workshop.Box";
const phpHostKinds=[{name: "Box",id,hash}];
const obj={kind: "named",id};
const parameters=[{name: "box",type: obj},{name: "f",type: {kind: "io-callback",argument: obj,reply: obj}}];
const entries=[{declaration: "Workshop.relay",name: "relay"
	, delivery: "task",effect: "BaseIO",taskIO: true,parameters
	, result: obj}];
const options={componentIdentity: "b".repeat(64),name: "php-"+hash,modules: ["Workshop"],entries,integerMode: "words",phpHostKinds,phpDelivery: true};

test("only the native PHP owner can compile the checked PHP worker object carriers",()=>{
	const gen=generateCTaskExports(options);
	assert.match(gen.entryLean,/LeanBridge\.Host\.Php\.Box/u);
	assert.doesNotMatch(gen.source+gen.header,/host_ticket|LB_WASM_HOST_ERRORS|lb_host_io_error/u);
	for(const extra of [{phpDelivery: false},{rubyDelivery: true},{integerMode: "gmp"},{wasmTasks: true,wasmCallbacks: true},{witCallbacks: true}])
		assert.throws(()=>generateCTaskExports({...options,...extra}),/exclusive native PHP/u);
	assert.throws(()=>generateCTaskExports({...options,phpHostKinds: [...phpHostKinds,...phpHostKinds]}),/lease layout/u);
});
test("PHP byte port requires the exact class identity and keeps JavaScript exceptions off its wire",()=>{
	const {prefix}=generateCTaskExports(options);
	const wire=generateSyncWire(prefix,entries,{tasks: true,phpHostKinds});
	assert.deepEqual(wire.methods[0].callbacks,[[1,"host:"+hash,"host:"+hash]]);
	assert.doesNotMatch(wire.source,/host_ticket/u);
	const model={prefix,methods: wire.methods,wire};
	assert.doesNotThrow(()=>generatePhpIOPort({...model,phpHostKinds}));
	for(const bad of [[],[{...phpHostKinds[0],hash: "0".repeat(64)}],[{...phpHostKinds[0],name: "Other"}]])
		assert.throws(()=>generatePhpIOPort({...model,phpHostKinds: bad}),/resource wire/u);
	for(const extra of [{},{tasks: true,witCallbacks: true},{tasks: true,wasmTasks: true,wasmCallbacks: true}])
		assert.throws(()=>generateSyncWire(prefix,entries,{...extra,phpHostKinds}),/native PHP task wire/u);
});
