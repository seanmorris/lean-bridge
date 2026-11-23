/** @file Keep threaded notification and native readiness profiles distinct at generation time. */
import assert from "node:assert/strict";
import test from "node:test";
import {generateCTaskExports} from "../src/backends/c/task-exports.mjs";
import {generateSyncWire} from "../src/backends/c/sync-wire.mjs";
import {generateTaskControl} from "../src/backends/javascript/task-control.mjs";
import {javaScriptTaskAbi} from "../src/abi/javascript-wasm-tasks.mjs";
import {reconcileHostExports} from "../src/analyze/host-export-model.mjs";

const t = {kind: "primitive",name: "uint32"};
const entries = [{name: "work",declaration: "Job.work",parameters: [{name: "n",type: t}],effect: "pure",result: t,delivery: "task"}];
const config = {name: "job",modules: ["Job"],componentIdentity: "a".repeat(64),entries,integerMode: "words"};

test("native fd readiness and Wasm owner tokens are distinct generated ABIs", () => {
	const native = generateCTaskExports(config), wasm = generateCTaskExports({...config,wasmTasks: true});
	const fd = generateSyncWire(native.prefix,entries,{tasks: true}), notify = generateSyncWire(wasm.prefix,entries,{tasks: true,wasmTasks: true});
	assert.ok(fd.wait && fd.methods[0].names.poll); assert.match(fd.source, /epoll_create1/u);
	assert.equal(notify.wait,undefined);
	assert.deepEqual(Object.keys(notify.methods[0].names).sort(),["cancel","close","listen","start","take"]);
	assert.doesNotMatch(notify.source, /eventfd|epoll|_poll\(/u); assert.match(notify.source,/args\[0\] > UINT32_MAX/u);
	assert.match(wasm.source,/lean_io_cancel_core\(e->watch.source\)/u);
	assert.notEqual(wasm.entryModule,generateCTaskExports({...config,wasmTasks: true,componentIdentity: "b".repeat(64)}).entryModule);
	const control = generateTaskControl("lb_js_task_"+"a".repeat(64),notify);
	assert.match(control,/base % 8/u); assert.throws(() => generateTaskControl("public_api",notify),TypeError);
});

test("threaded task generation refuses incompatible host and ownership contracts", () => {
	for(const extra of [{integerMode: "gmp"},{phpDelivery: true},{synchronousIO: true}])
		assert.throws(() => generateCTaskExports({...config,wasmTasks: true,...extra}),TypeError);
	for(const extra of [{wasm32: true},{phpWasm: true},{tasks: false},{resources: [{}]}])
		assert.throws(() => generateSyncWire("lbc_job",entries,{tasks: true,wasmTasks: true,...extra}),TypeError);
	const callback = [{...entries[0],parameters: [{name: "cb",type: {kind: "io-callback",argument: t,reply: t}}]}];
	assert.throws(() => generateCTaskExports({...config,entries: callback,wasmTasks: true}),TypeError);
	assert.throws(() => generateSyncWire("lbc_job",callback,{tasks: true,wasmTasks: true}),TypeError);
});

test("the pthread wire authenticates nominal kind and borrowing separately from the result lease", () => {
	const declaration="Shared.Ticket", hash="b".repeat(64), named={kind: "named",id: "lean:"+declaration};
	const component={name: "jobs",id: "jobs@1.0.0",version: "1.0.0"};
	const owned=[{declaration,module: "Shared",identity: hash}];
	const selection={exports: ["Job.work"],exportModules: ["Job"],modules: ["Shared","Job"],taskExports: ["Job.work"],leanResources: [declaration],members: []};
	const entry={...entries[0],module: "Job",hostMembers: [],effect: "EIO",result: named,error: named,parameters: [{name: "ticket",type: named}]};
	const metadata={kind: "lean-bridge-host-export-metadata",schemaVersion: 1,leanVersion: "4.32.2",entries: [entry]};
	const {api,entries: checked}=reconcileHostExports({component,owned,selection,metadata});
	const abi=javaScriptTaskAbi(api,config.componentIdentity);
	const wire=generateSyncWire("lbc_job",checked,{tasks: true,wasmTasks: true,resources: api.types});
	assert.equal(abi.leases[0].type,"lease:"+hash);
	assert.equal(abi.leases[0].tag,wire.leases[0].tag);
	assert.deepEqual(abi.methods[0].args,["lease:"+hash]); assert.equal(abi.methods[0].error,abi.methods[0].result);
	const refused=(mutate,reason) => {
		const wrong=structuredClone(api); mutate(wrong); assert.throws(() => javaScriptTaskAbi(wrong,config.componentIdentity),reason);
	};
	refused(ir => {ir.declarations[0].parameters[0].ownership="lease";},/lease|ownership/u);
	refused(ir => {ir.declarations[0].result.lifetime.scope="call";},/lease|lifetime/u);
	refused(ir => {ir.types[0].resource.disposal="optional";},/disposal|nominal/u);
	refused(ir => {ir.types[0].source.extensions["lean-bridge.dev/resource-identity"]="a".repeat(64);},/nominal/u);
});

test("public error identities and delivery phases cannot be interchanged", () => {
	const name = "Job.work", id = "c".repeat(64);
	const {api} = reconcileHostExports({component: {name: "jobs",id: "jobs@1.0.0",version: "1.0.0"}
		, selection: {exports: [name],exportModules: ["Job"],taskExports: [name],taskIOErrors: [name],members: []}
		, metadata: {kind: "lean-bridge-host-export-metadata"
			, schemaVersion: 1, leanVersion: "4.32.2"
			, entries: [{...entries[0],module: "Job",hostMembers: [],effect: "EIO",error: t,taskIO: true}]}});
	const method = javaScriptTaskAbi(api,id).methods[0];
	assert.equal(method.startId,"error:EIO.Job.work"); assert.equal(method.error,"uint32");
	assert.equal(method.terminalId,"error:TaskIO.Error"); assert.equal(method.terminal,"string");
	const wrong = structuredClone(api); wrong.errors.find(e => e.id === method.terminalId).payload = t;
	assert.throws(() => javaScriptTaskAbi(wrong,id),/Unexpected typed payload/u);
	const hidden = structuredClone(api); delete hidden.declarations[0].source.extensions["lean-bridge.dev/task-failure"];
	assert.throws(() => javaScriptTaskAbi(hidden,id),/failure channels/u);
	const optional=structuredClone(api);
	Object.assign(optional.declarations[0].parameters[0],{optional: true,default: {kind: "integer",value: "7"}});
	assert.throws(() => javaScriptTaskAbi(optional,id),/Inconsistent copied/u);
});
