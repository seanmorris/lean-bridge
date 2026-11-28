/** @file Exercise statically declared JavaScript imports on actual application classes. */
import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {componentScalarTypes} from "../src/abi/component-scalars.mjs";
import {javaScriptHostMembers} from "../src/backends/javascript/host-members.mjs";
import {bindWasmHostMembers} from "../src/runtime/wasm-host-members.mjs";
import {installWasmHostDomain} from "../src/runtime/wasm-host-loader.mjs";
import {createWasmHostWire} from "../src/runtime/wasm-host-wire.mjs";
import {canonicalJson,sha256} from "../src/capsule/node.mjs";
import {assertJavaScriptIOConfiguration} from "../src/release/javascript-wasm-io-package.mjs";

const ir=JSON.parse(await readFile(new URL("./fixtures/javascript-host-meter/lean-bridge.hosts.json",import.meta.url)));
const clone=()=>structuredClone(ir);
const slot=(m,op,name)=>m.members.findIndex(s=>s.op===op && s.name===name);
test("host configuration selects synchronous classes without granting other capabilities",async ()=>{
	const configuration=JSON.parse(await readFile(new URL("./fixtures/javascript-host-meter/lean-bridge.exports.json",import.meta.url)));
	assert.doesNotThrow(()=>assertJavaScriptIOConfiguration(configuration));
	assert.doesNotThrow(()=>assertJavaScriptIOConfiguration({...configuration,nativeEffects: []}));
	assert.throws(()=>assertJavaScriptIOConfiguration({...configuration,nativeEffects: ["filesystem"]}),/only in-memory/);
	assert.throws(()=>assertJavaScriptIOConfiguration({...configuration,taskExports: ["Workshop.make"]}),/taskExports/);
	const {hostImports,...ordinary}=configuration;
	assert.equal(typeof hostImports,"string");assert.throws(()=>assertJavaScriptIOConfiguration(ordinary),/only in-memory/);
});
test("browser-safe nominal keys preserve the original producer identity",()=>{
	const {kinds}=javaScriptHostMembers(ir);
	for(const [i,t] of ir.types.entries())
		assert.equal(kinds[i].key,sha256(canonicalJson([ir.component.id,t.id,t.resource.kindId])));
});
test("a host callback cannot return to Wasm or allocate a reply after nested retirement",()=>{
	const model=javaScriptHostMembers(ir),op=slot(model,"method","read"),heap=new Uint8Array(1024);
	model.members[op].result="string";
	let retired=false,allocations=0;
	/** Simulate a callback catching the nested heap failure and returning a value anyway. */
	class Box
{ /** Retire before a copyable reply can be stored. */
		read(){retired=true;return "no native allocation";} }
	const wire=createWasmHostWire({HEAP8: heap,_malloc: ()=>{allocations++;return 512;}},model,{Box},{resolve: ()=>new Box()}
		,{assertOpen: ()=>{if(retired) throw new Error("retired");},poison: ()=>{retired=true;}});
	const v=new DataView(heap.buffer);v.setUint32(32,64,true);v.setUint32(40,1,true);
	assert.throws(()=>wire.call(op,1,32,64),/retired/);assert.equal(allocations,0);assert.equal(wire.observed(64),null);
});
test("native retirement failure poisons its shared heap without reentering the allocator",async ()=>{
	const trap=new WebAssembly.RuntimeError("retire failed"),heap=new Uint8Array(2048);
	let retired=false,frees=0;
	const noop=()=>{};
	const wasm={HEAP8: heap,FS: {writeFile: noop,unlink: noop}
		, loadDynamicLibrary: async()=>{}
		, _bridge_lean_runtime_status: ()=>2,_malloc: ()=>32,_free: ()=>{frees++;}
		, _bridge_scalar_call: ()=>{throw trap;}};
	const domain=await installWasmHostDomain(wasm,Uint8Array.of(1),{assertOpen: ()=>assert.equal(retired,false),poison: ()=>{retired=true;}});
	const session=domain.bind("1".repeat(64),javaScriptHostMembers(ir),{Box: Object});
	assert.throws(()=>session.close(),e=>e===trap);
	assert.equal(retired,true);assert.equal(frees,0);
});
test("checked member dispatch calls the real class, property and subclass and preserves thrown values",()=>{
	const model=javaScriptHostMembers(ir);
	let binds=0,gets=0,sets=0,reads=0;
	/** Application class that counts every observable operation. */
	class Meter
	{
		/**
		 * Create an application instance.
		 *
		 * @param level - Starting meter value.
		 */
		constructor(level) { this.value=level; }
		/** Observe a property read separately from a method call. */
		get level() { gets++; return this.value; }
		/**
		 * Count writes without conflating them with reads.
		 *
		 * @param v - New value supplied by the host bridge.
		 */
		set level(v) { sets++; this.value=v; }
		/** Read through the method selector. */
		read() { reads++;return this.value; }
		/** Return the actual receiver, not a copy. */
		identity() { return this; }
		/** Fail if bridge code delegates a nominal check to the application. */
		static [Symbol.hasInstance]() { throw new Error("untrusted instanceof"); }
	}
	const call=bindWasmHostMembers(model,{/** Capture how often the binding is resolved. */
		get Box() { binds++;return Meter; }});
	const invoke=(op,name,...args)=>call(slot(model,op,name),args);
	const m=invoke("constructor","create",18);
	assert.equal(invoke("set","level",m,42),undefined);
	assert.equal(invoke("get","level",m),42);
	assert.equal(invoke("method","read",m),42);
	assert.equal(invoke("method","identity",m),m);
	assert.deepEqual([binds,gets,sets,reads],[1,1,1,1]);
	/** Check that actual subclass dispatch survives the boundary. */
	class Child extends Meter
	{
		/** Distinguish this override from the base implementation. */
		read() { return this.value+1; }
	}
	assert.equal(invoke("method","read",new Child(8)),9);
	assert.throws(()=>invoke("method","read",{}),/Wrong JavaScript host object/u);
	assert.throws(()=>invoke("set","level",m,-1),RangeError);
	assert.equal(sets,1);
	assert.throws(()=>invoke("get","level",m,42),/invocation/u);
	/** A nominally valid receiver with an invalid reply. */
	class Wrong extends Meter
	{
		/** Return a different, undeclared type. */
		identity() { return {}; }
	}
	assert.throws(()=>invoke("method","identity",new Wrong(0)),/Wrong JavaScript host object/u);
	for(const thrown of [undefined,0,Symbol("failure"),new Error("failure")])
	{
		/** Deliver a specific thrown value without coercion. */
		class Raises extends Meter
		{
			/** Simulate the application's exception, including undefined. */
			read() { throw thrown; }
		}
		let caught=false;
		try
		{ invoke("method","read",new Raises(0)); }
		catch(e)
		{ caught=true;assert.equal(e,thrown); }
		assert.ok(caught);
	}
	assert.equal(invoke("method","read",m),42);
	assert.throws(()=>bindWasmHostMembers(model,Object.create({Box: Meter})),/declared/u);
	assert.throws(()=>bindWasmHostMembers(model,{Box: ()=>{}}),/class/u);
});

test("JavaScript slot identities and lifetime policies come from the owned host contract",()=>{
	const model=javaScriptHostMembers(ir), identity=model.members[slot(model,"method","identity")];
	assert.deepEqual(identity.inputOwnership,["borrow"]);assert.equal(identity.resultOwnership,"lease");
	assert.equal(model.kinds[identity.owner].policy,"weak-canonical");
	assert.equal(identity.symbol,"lean_bridge_host_javascript_box_identity");
	const anchored=clone(), d=anchored.declarations.find(x=>x.name==="identity");
	d.result.ownership="borrow";d.result.lifetime={scope: "receiver",anchor: "receiver"};
	assert.equal(javaScriptHostMembers(anchored).members.find(x=>x.name==="identity").anchor,0);
	const dynamic=clone();dynamic.types[0].host.dynamic=true;
	assert.throws(()=>javaScriptHostMembers(dynamic),/dynamic|statically/u);
	const other=clone();other.types[0].host.targets=["perl"];
	assert.throws(()=>javaScriptHostMembers(other),/statically/u);
	const wrong=clone();wrong.declarations.find(x=>x.name==="read").resultMode="promise";
	assert.throws(()=>javaScriptHostMembers(wrong),/async|synchronous|promise/iu);
});

test("static host members validate both sides of all scalar signatures", () => {
	const cases = {unit: undefined
		, bool: true
		, uint8: 255
		, uint16: 65535
		, uint32: 0xffff_ffff
		, uint64: 0xffff_ffff_ffff_ffffn
		, int8: -128
		, int16: -32768
		, int32: -2147483648
		, int64: -(1n << 63n)
		, nat: 1n << 100n
		, int: -(1n << 120n)
		, float32: 1/3
		, float64: -0
		, string: "a\0🌊"
		, bytes: Uint8Array.of(0,255)
		, char: "🌊"
		, usize: 0xffff_ffff
		, isize: -2147483648};
	assert.deepEqual(Object.keys(cases).sort(), [...componentScalarTypes].sort());
	const contract = clone(), sample = contract.declarations.find(d => d.kind === "constructor").parameters[0];
	const original = contract.declarations.find(d => d.name === "read");
	contract.declarations = Object.keys(cases).map(type => {
		const name = "echo_" + type, t = {kind: "primitive", name: type};
		return {...original, id: "host:meter.Box." + name
			, name, overloadKey: name, kind: "static-method", receiver: null
			, parameters: [{...sample, type: t}], result: {...original.result, type: t}};
	});
	const model = javaScriptHostMembers(contract);
	/** Constructor to which each scalar-specific static method is attached. */
	class Meter {}
	let observed;
	/**
	 * Echo the value and check the JavaScript static receiver.
	 *
	 * @param v - Already validated value sent to the application.
	 */
	function echo(v) { assert.equal(this, Meter); observed = v; return v; }
	for(const d of model.members) Meter[d.name] = echo;
	const call = bindWasmHostMembers(model, {Box: Meter});
	for(const [i, d] of model.members.entries())
	{
		const v = cases[d.result], result = call(i, [v]);
		assert.deepEqual(result, d.result === "float32" ? Math.fround(v) : v);
		if(d.result === "bytes")
		{ assert.notEqual(result, observed); assert.notEqual(observed, v); }
	}
	const i = model.members.findIndex(d => d.result === "usize");
	let count = 0; Meter.echo_usize = () => { count++; return 0x1_0000_0000; };
	assert.throws(() => call(i, [0x1_0000_0000]), RangeError);
	assert.equal(count, 0);
	assert.throws(() => call(i, [1]), RangeError);
	assert.equal(count, 1);
});

test("borrowed parameter anchors resolve to the correct slot and impossible selectors are rejected", () => {
	const doc = clone(), identity = doc.declarations.find(d => d.name === "identity");
	const shape = doc.declarations.find(d => d.kind === "constructor").parameters[0];
	identity.parameters = [{...shape, ...identity.receiver, name: "peer"}];
	identity.result.ownership = "borrow";
	identity.result.lifetime = {scope: "parameter", anchor: "peer"};
	assert.equal(javaScriptHostMembers(doc).members.find(d => d.name === "identity").anchor, 1);
	identity.parameters[0] = {...shape, name: "peer"};
	assert.throws(() => javaScriptHostMembers(doc), /anchor|lifetime/iu);
	const conflict = clone(), method = conflict.declarations.find(d => d.name === "read");
	method.name = "level";
	assert.throws(() => javaScriptHostMembers(conflict), /ambiguous/iu);
	const model = javaScriptHostMembers(ir);
	/** Getter-only class used with a writable declared selector. */
	class Readonly
	{
		/** Constant property cannot be set. */
		get level() { return 7; }
	}
	assert.throws(() => bindWasmHostMembers(model, {Box: Readonly})(slot(model,"set","level"), [new Readonly(), 42]), /Cannot set/u);
});
