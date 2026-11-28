/** @file Keep factory signatures and the installed C symbol surface separate from private dispatch. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {staticHostMembers} from "../../src/backends/native/static-host-members.mjs";
import {emitWordHostMembers} from "../../src/backends/native/word-host-members.mjs";
import {emitWordHostExports} from "../../src/backends/native/word-host-exports.mjs";
import {cHostFacade} from "../../src/backends/c/host-facade.mjs";
import {rustHostFacade} from "../../src/backends/rust/host-facade.mjs";

test("C factories have site-typed calls and release without exposing a Lean pointer or dispatch operation",async()=>{
	const ir=JSON.parse(await readFile(new URL("../fixtures/c-host-members/lean-bridge.hosts.json",import.meta.url)));
	const model=staticHostMembers(ir,"c"),members=emitWordHostMembers(ir,model,"c");
	const box={kind: "named",id: ir.types[0].id},num={kind: "primitive",name: "uint32"};
	const result={kind: "io-closure",argument: num,reply: box};
	const entry={name: "remember",declaration: "Closures.remember",effect: "IO",parameters: [{name: "box",type: box}],result};
	const o={ir,entries: [entry],identity: "a".repeat(64),modules: ["Closures"]};
	const wire=emitWordHostExports(o,members,"c"),pub=cHostFacade({...o,model,name: "demo",prefix: wire.prefix});
	assert.match(wire.entryLean,/UInt32 → _root_\.IO _root_\.LeanBridge\.Host\.C\.Box/u);
	assert.match(pub.header,/demo_remember_call\(const demo_remember_closure \*fn, uint32_t a0, demo_box \*value, demo_diagnostic \*diag\)/u);
	assert.match(pub.header,/demo_remember_drop\(demo_remember_closure \*fn\)/u);
	assert.ok(!pub.symbols.some(s=>!s.startsWith("demo_")));
	assert.doesNotMatch(pub.header,/dn_closure|lean_object|dispatch|\.fn\b/u);
	for(const e of [{...entry,effect: "EIO"},{...entry,delivery: "task"},{...entry,parameters: [{name: "f",type: result}]}])
		assert.throws(()=>emitWordHostExports({...o,entries: [e]},members,"c"),/closure|factory/u);
});

test("Rust host closures select the matching factory, apply and drop operations; ordinary bindings use the old open protocol",async()=>{
	const ir=JSON.parse(await readFile(new URL("../fixtures/c-host-members/lean-bridge.hosts.json",import.meta.url)));
	ir.types[0].host.targets=["rust"];
	const model=staticHostMembers(ir,"rust"),members=emitWordHostMembers(ir,model,"rust");
	const box={kind: "named",id: ir.types[0].id},num={kind: "primitive",name: "uint32"},identity="a".repeat(64);
	const read={name: "read",declaration: "Workshop.read",parameters: [{name: "box",type: box}],effect: "IO",result: num};
	const factory={...read,name: "remember",declaration: "Closures.remember",result: {kind: "io-closure",argument: box,reply: num}};
	const emit=entries=>{
		const o={ir,model,entries,modules: ["Workshop","Closures"],identity};
		const wire=emitWordHostExports(o,members,"rust");
		return {rust: rustHostFacade({...o,prefix: wire.prefix,domainId: identity}),native: wire.source};
	};
	const plain=emit([read]);
	assert.match(plain.rust,/Connection::open\(/u);assert.doesNotMatch(plain.rust,/ReturnedOwner|open_with_returned_functions/u);
	assert.doesNotMatch(plain.native,/dn_closure_retire/u);
	const f=emit([read,factory]);assert.match(f.rust,/pub struct ReturnedRemember<H:Host>/u);
	assert.match(f.rust,/pub fn call\(&self,v0:&impl AsHost<H::Object0>\)->Result<u32,HostCallError>/u);
	assert.match(f.rust,/h\.port\.execute\(3,/u);assert.match(f.native,/case 3: status=dn_call_3\(/u);
	assert.match(f.rust,/h\.port\.execute::<Infallible>\(5,/u);assert.match(f.native,/case 5: status=dn_closure_drop\(s,1,/u);
	assert.match(f.rust,/Connection::open_with_returned_functions\(/u);
	assert.throws(()=>emit([read,{...factory,effect: "EIO"}]),/factory/u);
});
