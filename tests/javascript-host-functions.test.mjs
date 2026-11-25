/** @file Check JS-side ticket publication rollback independently of Wasm compilation. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {bindWasmHostFunctions} from "../src/runtime/wasm-host-functions.mjs";
import {createWasmTaskFunctions} from "../src/runtime/wasm-task-functions.mjs";
import {nativeHostSelection,reconcileHostExports} from "../src/analyze/host-export-model.mjs";
import {javaScriptHostMembers} from "../src/backends/javascript/host-members.mjs";
import {lowerWorkerHostFunctions} from "../src/backends/javascript/worker-host-functions.mjs";
import {generateCTaskExports} from "../src/backends/c/task-exports.mjs";
import {generateSyncWire} from "../src/backends/c/sync-wire.mjs";
import {javaScriptTaskAbi} from "../src/abi/javascript-wasm-tasks.mjs";
import {wasmWorkerMethods,wasmWorkerLeases} from "../src/abi/wasm-host-factories.mjs";

const fixture=()=>{
	const methods=[{name: "remember",result: {argument: 0,reply: 0},args: [0]}],rows=new Map();
	let next=0n,closed=0,drops=0;
	const invoke=(m,index,args,owner,id)=>{
		assert.equal(owner,17);assert.equal(args.length,1);
		if(!index)
		{ rows.set(++next,args[0]);return next; }
		assert.equal(index,1);assert.ok(rows.has(id));args[0]?.reenter?.();return rows.get(id);
	};
	const control=(index,id)=>{
		if(index===3)
		{ rows.clear();return; }
		assert.equal(index,2);assert.ok(rows.delete(id));drops++;
	};
	return {api: bindWasmHostFunctions({methods},17,invoke,control,()=>closed++),rows,counts: ()=>[drops,closed]};
};
test("failed JS publication releases its native Lean function ticket exactly once",()=>{
	const f=fixture(),register=FinalizationRegistry.prototype.register;
	const error=new Error("publication refused");
	try
{
		FinalizationRegistry.prototype.register=()=>{throw error;};
		assert.throws(()=>f.api.remember({}),e=>e===error);
} finally
{ FinalizationRegistry.prototype.register=register; }
	assert.equal(f.rows.size,0);assert.deepEqual(f.counts(),[1,0]);
	const value={},fn=f.api.remember(value);
	assert.equal(fn({reenter: ()=>{assert.ok(fn.dispose());assert.equal(f.rows.size,1);assert.throws(()=>fn(null),/closed/i);}}),value);
	assert.ok(!fn.dispose());assert.ok(f.api.dispose());
	assert.deepEqual(f.counts(),[2,1]);
});
test("only the creating binding can revoke the returned function, and active unbind is refused",()=>{
	const a=fixture(),b=fixture(),one={},two={},fn=a.api.remember(one),other=b.api.remember(two);
	assert.equal(fn({reenter: ()=>assert.throws(()=>a.api.dispose(),/active/)}),one);
	assert.ok(a.api.dispose());assert.throws(()=>fn(two),/closed/i);assert.ok(!fn.dispose());assert.ok(!a.api.dispose());
	assert.equal(other(one),two);assert.ok(b.api.dispose());assert.deepEqual(b.counts(),[0,1]);
});
test("an escaped function does not keep its unreachable creating binding alive",{skip: !globalThis.gc},async()=>{
	const orphan=()=>{
		const {api,rows,counts}=fixture();
		return {fn: api.remember({}),rows,counts};
	};
	const {fn,rows,counts}=orphan();
	for(let i=0;i<60 && rows.size;i++)
{
		await new Promise(done=>setImmediate(done));globalThis.gc();await new Promise(done=>setImmediate(done));
}
	assert.deepEqual(counts(),[0,1]);assert.equal(rows.size,0);assert.throws(()=>fn(null),/closed/i);
});
test("worker factory and private application agree on one native kind without exposing a resource class",async()=>{
	const ir=JSON.parse(await readFile("tests/fixtures/javascript-host-meter/lean-bridge.hosts.json")),module="LeanBridge.Host.Javascript";
	const box={kind: "named",id: ir.types[0].id},component={name: "job",id: "job@1.0.0",version: "1.0.0"};
	const first="Workshop.remember",next="Workshop.work",read=module+".Box.read",policy="native-host-io-v1";
	const selection={...nativeHostSelection(ir,"javascript")
		, exports: [first,next]
		, exportModules: ["Workshop"]
		, modules: ["Workshop",module]
		, nativeEffectPolicy: policy
		, nativeEffects: []
		, taskExports: [next]
		, asyncIterators: []
		, javascriptThreadedHostMembers: true
		, javascriptTaskCallbacks: true};
	const metadata={kind: "lean-bridge-host-export-metadata"
		, schemaVersion: 1
		, leanVersion: "4.32.2"
		, entries: [
		{declaration: first,module: "Workshop",parameters: [{name: "v",type: box}],result: {kind: "io-closure",argument: box,reply: box},effect: "IO",hostMembers: [read]}
		, {declaration: next,module: "Workshop",parameters: [{name: "v",type: box}],result: box,effect: "BaseIO",delivery: "task",hostMembers: []}
		]
	, nativeEffectAudit: {policy,initializers: [],roots: [{declaration: first,leaves: [{name: read,module,symbol: "lean_bridge_host_javascript_box_read"}]},{declaration: next,leaves: []}]}};
	const {api,entries}=reconcileHostExports({component,ir,metadata,selection}),identity="a".repeat(64),abi=javaScriptTaskAbi(api,identity,ir);
	const kinds=javaScriptHostMembers(ir).kinds.map((k,i)=>({name: k.name,hash: k.key,id: ir.types[i].id}));
	const lowered=lowerWorkerHostFunctions(api,abi,entries,[]),opts={name: "job"
		, modules: ["Workshop"]
		, entries: lowered.entries
		, resources: lowered.resources
		, wasmHostKinds: kinds
		, wasmTasks: true
		, integerMode: "words"
		, componentIdentity: identity
		, wasmFunctionDefinitions: lowered.definitions};
	const gen=generateCTaskExports(opts),wire=generateSyncWire(gen.prefix,opts.entries,{tasks: true,wasmTasks: true,resources: opts.resources,wasmHostKinds: kinds});
	assert.equal(abi.methods.length,2);assert.equal(abi.leases,undefined);assert.equal(wire.methods.length,3);
	const fields=({args,result,name,declaration})=>({args,result,name,declaration});
	assert.deepEqual(wasmWorkerMethods(abi).map(fields),wire.methods.map(fields));
	assert.deepEqual([...wasmWorkerLeases(abi),...abi.hostKinds].map(r=>[r.hash,r.tag]),wire.leases.map(r=>[r.hash,r.tag]));
	assert.match(gen.entryLean,/abbrev BridgeHostFactory[\da-f]+\.Fn[\da-f]+ := _root_\.LeanBridge\.Host\.Javascript\.Box → _root_\.IO _root_\.LeanBridge\.Host\.Javascript\.Box/u);
	assert.throws(()=>generateCTaskExports({...opts,wasmZendObjects: true}),/private JavaScript worker function/u);
	for(const edit of [k=>{k.callable.resultMode="promise";},k=>{k.source.extensions["lean-bridge.dev/closure-owner"]="php-host-binding";},k=>{k.callable.failure.errors=["error:IO.Error"];}])
{
		const bad=structuredClone(api);edit(bad.types.find(t=>t.kind==="callback"));assert.throws(()=>javaScriptTaskAbi(bad,identity,ir));
}
});
test("worker disposes unpublished leases and revokes only its own active callables",()=>{
	let closed=0,open=true;
	const owner={},scope=createWasmTaskFunctions(owner,{open: ()=>open,apply: (method,[lease,v])=>{v?.probe?.();return [method,lease.value,v];},collect: ()=>{},dispose: async()=>{}});
	const lease=()=>({value: {},dispose: ()=>{closed++;return true;}}),x=lease(),v={};
	const f=scope.publish("private",x);
	assert.deepEqual(f(v),["private",x.value,v]);
	const register=FinalizationRegistry.prototype.register,err=new Error("registration failed");
	try
{
		FinalizationRegistry.prototype.register=()=>{throw err;};
		assert.throws(()=>scope.publish("private",lease()),e=>e===err);
} finally
{ FinalizationRegistry.prototype.register=register; }
	assert.equal(closed,1);const probe={probe: ()=>{assert.ok(f.dispose());assert.equal(closed,1);assert.throws(()=>f(v),/closed/);}};
	assert.deepEqual(f(probe),["private",x.value,probe]);assert.equal(closed,2);
	open=false;assert.throws(()=>f(v),/closed/);
	scope.revoke();assert.equal(closed,2);assert.ok(!f.dispose());
	assert.throws(()=>scope.publish("private",lease()),/closed/);assert.equal(closed,3);
});
