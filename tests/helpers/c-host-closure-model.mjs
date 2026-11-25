/** @file Keep factory signatures and the installed C symbol surface separate from private dispatch. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {staticHostMembers} from "../../src/backends/native/static-host-members.mjs";
import {emitWordHostMembers} from "../../src/backends/native/word-host-members.mjs";
import {emitWordHostExports} from "../../src/backends/native/word-host-exports.mjs";
import {cHostFacade} from "../../src/backends/c/host-facade.mjs";

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
