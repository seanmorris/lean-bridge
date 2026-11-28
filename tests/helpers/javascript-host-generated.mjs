/** @file Compile and execute contract-derived host externs against the pinned shared heap. */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { componentScalarTypes } from "../../src/abi/component-scalars.mjs";
import { generateJavaScriptHostExterns } from "../../src/backends/javascript/host-wasm-externs.mjs";
import { generateLeanHostObjectAdapters } from "../../src/backends/lean/host-object.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createWasmHostErrorStore, createWasmHostWire } from "../../src/runtime/wasm-host-wire.mjs";

/**
 * Extend the test contract with every copied scalar and both anchor kinds.
 *
 * @param ir - Fresh meter fixture for this compilation.
 */
export const addHostProbeMembers=ir=>{
	const read = ir.declarations.find(d=>d.name==="read"), parameter = ir.declarations.find(d=>d.kind==="constructor").parameters[0];
	const identity = ir.declarations.find(d=>d.name==="identity");
	for(const [name,scope,anchor] of [["child","receiver","receiver"],["childOf","parameter","peer"]])
	{
		ir.declarations.push({...identity,name,id: "host:meter.Box."+name
			, overloadKey: "Box."+name
			, parameters: scope==="receiver"?[]:[{...parameter,...read.receiver,name: "peer"}]
			, result: {...identity.result,ownership: "borrow",lifetime: {scope,anchor}}});
	}
	ir.declarations.push({...read,name: "consume",id: "host:meter.Box.consume"
		, overloadKey: "Box.consume"
		, receiver: {...read.receiver,ownership: "transfer",lifetime: {scope: "call",anchor: null}}});
	for(const kind of componentScalarTypes)
	{
		const name = "echo_"+kind, type = {kind: "primitive",name: kind};
		ir.declarations.push({...read,name,id: "host:meter.Box."+name
			, overloadKey: "Box."+name
			, parameters: [{...parameter,type}]
			, result: {...read.result,type}
			, source: {...read.source,declaration: "Box."+name}});
	}
};
/**
 * Check both the fresh C prototypes and the compiled values. The nominal
 * domain here is intentionally instrumented; it is not an installed adapter.
 *
 * @param tools - Private build directory, pinned producer and prepared Wasm heap.
 */
export const checkGeneratedHostWasm = async tools => {
	const {app,run,lean,emcc,target,runtime,input,oracle} = tools;
	const ir = JSON.parse(await readFile(join(input,"lean-bridge.hosts.json")));
	addHostProbeMembers(ir);
	const generated = generateJavaScriptHostExterns(ir,sha256(canonicalJson(ir))), host = "LeanBridge/Host/Javascript";
	await mkdir(join(app,"LeanBridge/Host"),{recursive: true});
	await writeFile(join(app,host+".lean"),generateLeanHostObjectAdapters(ir)[host+".lean"]);
	await copyFile(join(input,"Workshop.lean"),join(app,"Workshop.lean"));
	await copyFile(join(oracle,"GeneratedProbe.lean"),join(app,"GeneratedProbe.lean"));
	await copyFile(join(oracle,"generated-service.c"),join(app,"service.c"));
	await writeFile(join(app,"members.inc"),generated.source);
	await writeFile(join(app,"renames.h"),generated.renames);
	for(const [m,c] of [[host,"host"],["Workshop","workshop"],["GeneratedProbe","probe"]])
		await run(lean,["-j1","-o",m+".olean","-c",c+".c",m+".lean"]);
	const includes = [join(target,"cmake/include"),resolve("src/backends/javascript"),resolve("poc/lean-link-spike")].flatMap(p=>["-I",p]);
	const flags = ["-O1","-g0","-fPIC","-fwasm-exceptions","-fvisibility=hidden","-DLEAN_EMSCRIPTEN","-include","renames.h",...includes];
	for(const n of ["service","workshop","probe"]) await run(emcc,[...flags,"-c",n+".c","-o",n+".o"]);
	await run(emcc,["-O1","-fwasm-exceptions","-sSIDE_MODULE=2","-Wl,--no-entry","-Wl,--export=lb_js_generated_control","service.o","workshop.o","probe.o","-o","generated.wasm"]);
	const {default: create} = await import(pathToFileURL(join(runtime,"main.mjs")));
	const wasm = await create({wasmBinary: await readFile(join(runtime,"main.wasm"))});
	assert.equal(wasm._bridge_lean_runtime_init(),1);
	const refs = new Map(), seen = new Set(), errors = createWasmHostErrorStore(), escaped = [];
	let sequence = 0, nested, readBehavior = () => 42;
	const domain = {pin: (kind,value,anchor) => {
		assert.equal(kind,0);
		const key=++sequence; refs.set(key,{value,count: 1,anchor}); return key;
	}
	, resolve: (kind,key) => { assert.equal(kind,0);return refs.get(key).value; }
	, retain: (key,anchor) => {
		const row=refs.get(key); assert.equal(row.anchor,anchor?refs.get(anchor).value:null);
		row.count++;
	}
	, release: key => { if(!--refs.get(key).count) refs.delete(key); }
	, record: (status,out) => {
		const f=wasm.lbHostWire.failure(out); assert.equal(status,f.application?1:3);
		return errors.keep(f);
	}
	, discard: errors.discard};
	/** Test application constructor with real instance dispatch. */
	class Meter
	{
		/**
		 * Set the initial property used by the compiled probe.
		 *
		 * @param n - Initial level.
		 */
		constructor(n) { this.level=n; }
		/** Share the underlying object through a second Lean alias. */
		identity() { return this; }
		/** Return a child anchored to the receiver. */
		child() { return new Meter(this.level+1); }
		/**
		 * Return a child anchored to an explicitly supplied peer.
		 *
		 * @param peer - Owner named by the contract.
		 */
		childOf(peer) { return new Meter(peer.level+1); }
		/** Consume a transferred receiver, returning its reading. */
		consume() { return this.level; }
		/** Apply the selected synchronous application behavior. */
		read() { return readBehavior(this); }
	}
	for(const k of componentScalarTypes) Meter.prototype["echo_"+k] = v => {
		seen.add(k);
		if(k==="unit") return undefined;
		if(k==="bool") return !v;
		if(k==="char")
		{ assert.equal(v,"🐝");return "🦋"; }
		if(k==="string") return v+"!";
		if(k==="bytes")
		{ v[0]=42;return v; }
		if(k==="nat") return v+7n;
		if(k==="int") return v-7n;
		if(k.startsWith("float")) return -v;
		return k.startsWith("u") ? v-(typeof v==="bigint"?1n:1) : v+(typeof v==="bigint"?1n:1);
	};
	wasm.lbHostDomain=domain; wasm.lbHostWire=createWasmHostWire(wasm,generated.model,{Box: Meter},domain);
	wasm.FS.writeFile("/generated.wasm",await readFile(join(app,"generated.wasm")));
	try
	{ await wasm.loadDynamicLibrary("/generated.wasm",{global: true,loadAsync: true,nodelete: true}); }
	finally
	{ wasm.FS.unlink("/generated.wasm"); }
	const symbol=wasm._malloc(32);
	wasm.HEAP8.set(new TextEncoder().encode("lb_js_generated_control\0"),symbol);
	const invoke=mode=>{
		const p=wasm._malloc(32); assert.ok(p); wasm.HEAP8.fill(0,p,p+32);
		try
		{
			new DataView(wasm.HEAP8.buffer).setUint32(p+12,mode,true);
			const status=wasm._bridge_scalar_call(symbol,p);
			const token=new DataView(wasm.HEAP8.buffer).getUint32(p+20,true);
			if(token) escaped.push(errors.take(token));
			return [status,new DataView(wasm.HEAP8.buffer).getUint32(p+16,true)];
		} finally
		{ wasm._free(p); }
	};
	try
	{
		readBehavior = v=>v.level;
		assert.deepEqual(invoke(0),[0,42]); assert.equal(refs.size,0);
		assert.deepEqual([...seen].sort(),[...componentScalarTypes].sort());
		const thrown = Symbol("application failure");
		readBehavior = () => { throw thrown; };
		assert.deepEqual(invoke(1),[2,0]); assert.deepEqual(escaped.pop(),{application: true,error: thrown});
		readBehavior = () => { throw undefined; };
		assert.deepEqual(invoke(1),[2,0]); assert.deepEqual(escaped.pop(),{application: true,error: undefined});
		assert.deepEqual(invoke(2),[0,73]); assert.equal(escaped.length,0); assert.equal(errors.size(),0);
		assert.deepEqual(invoke(3),[2,0]); assert.equal(escaped.length,0); assert.equal(errors.size(),0);
		const first=new Error("same"),second=new Error("same"); let turn=0;
		readBehavior=()=>{throw ++turn===1?first:second;};
		assert.deepEqual(invoke(4),[2,0]); assert.equal(escaped.pop().error,first); assert.equal(errors.size(),0);
		readBehavior = () => -1;
		assert.deepEqual(invoke(1),[2,0]); const failure=escaped.pop();
		assert.equal(failure.application,false); assert.ok(failure.error instanceof RangeError);
		readBehavior=()=>{throw failure.error;};
		assert.deepEqual(invoke(1),[2,0]); assert.deepEqual(escaped.pop(),{application: true,error: failure.error});
		readBehavior = () => { readBehavior = () => 27; nested = invoke(1);return nested[1]+1; };
		assert.deepEqual(invoke(1),[0,28]); assert.deepEqual(nested,[0,27]);
		assert.equal(refs.size,0); assert.equal(errors.size(),0); assert.equal(escaped.length,0);
	} finally
	{ wasm._free(symbol); }
};
