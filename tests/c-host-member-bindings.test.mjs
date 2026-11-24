/** @file Verify application-owned C member slots, identity keys and compiler signatures. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {sha256Text} from "../src/binding-ir/sha256.mjs";
import {staticHostMembers} from "../src/backends/native/static-host-members.mjs";
import {emitWordHostMembers} from "../src/backends/native/word-host-members.mjs";
import {phpHostMembers,phpWasmHostMembers} from "../src/backends/php/host-members.mjs";

const fixture=new URL("./fixtures/javascript-host-meter/lean-bridge.hosts.json",import.meta.url);
test("C member contracts preserve distinct constructor, property and anchored result sites",async ()=>{
	const ir=JSON.parse(await readFile(fixture,"utf8"));
	const [type]=ir.types; type.host.targets=["c","php"];
	const identity=ir.declarations.find(d=>d.name==="identity");
	identity.result={...identity.result,ownership: "borrow",lifetime: {scope: "receiver",anchor: "receiver"}};
	const c=staticHostMembers(ir,"c"), php=phpHostMembers(ir);
	const originalKey=sha256Text(JSON.stringify([ir.component.id,type.id,type.resource.kindId],null,2)+"\n");
	assert.equal(php.kinds[0].key,originalKey);
	assert.equal(phpWasmHostMembers(ir).kinds[0].key,sha256Text("php-wasm-zend-v1:"+originalKey));
	assert.notEqual(c.kinds[0].key,originalKey);
	assert.deepEqual(c.members.map(({symbol,...m})=>m),php.members.map(({symbol,...m})=>m));
	assert.deepEqual(c.members.map(m=>[m.op,m.args,m.result]),[
		["method",[0],"uint32"],["constructor",["uint32"],0],["get",[0],"uint32"],
		["set",[0,"uint32"],"unit"],["method",[0],0]
	]);
	const native=emitWordHostMembers(ir,c,"c");
	assert.equal(c.members.at(-1).anchor,0);
	assert.ok(native.native.includes("stale or wrong-kind C host reference"));
	assert.ok(native.header.includes("lean_bridge_host_c_box_set_level(lean_object * a0,uint32_t a1)"));
	assert.ok(!native.header.includes("lean_bridge_host_php_"));
	const other=structuredClone(ir); other.types[0].resource.kindId+="Peer";
	assert.notEqual(staticHostMembers(other,"c").kinds[0].key,c.kinds[0].key);
	ir.types[0].host.targets=["php"]; assert.throws(()=>staticHostMembers(ir,"c"),/C host members/u);
});
