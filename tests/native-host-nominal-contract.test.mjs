/** @file Verify the nominal host contract independently of package-target admission. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {validateBindingIr} from "../src/binding-ir/contract.mjs";
import {generateLeanHostObjectAdapters} from "../src/backends/lean/host-object.mjs";
import {assertJsonSchema,jsonSchemaErrors} from "./helpers/json-schema.mjs";

const fixture=new URL("./fixtures/javascript-host-meter/lean-bridge.hosts.json",import.meta.url);
const names={c: "C",cpp: "Cpp",rust: "Rust","wit-wasi": "WitWasi"};
test("native application objects keep distinct Lean imports for C, C++, Rust and WIT",async ()=>{
	const ir=JSON.parse(await readFile(fixture,"utf8"));
	ir.types[0].host.targets=Object.keys(names);
	validateBindingIr(ir);
	await assertJsonSchema("binding-ir",ir);
	const v4="binding-ir-owned#/$defs/hostProjection";
	assert.equal(await jsonSchemaErrors(v4,{...ir.types[0].host,targets: [...Object.keys(names),"perl","php"]}),null);
	const files=generateLeanHostObjectAdapters(ir);
	assert.deepEqual(Object.keys(files).sort(),[...Object.values(names).map(n=>"LeanBridge/Host/"+n+".lean"),"host-object-manifest.json"].sort());
	for(const [target,name] of Object.entries(names))
	{
		const source=files["LeanBridge/Host/"+name+".lean"];
		assert.ok(source.includes("namespace LeanBridge.Host."+name));
		assert.ok(source.includes("opaque Box : Type"));
		assert.ok(source.includes('@[extern "lean_bridge_host_'+target.replaceAll("-","_")+'_box_read"]'));
		assert.ok(source.includes("opaque read (self : @& Box) : _root_.IO (_root_.UInt32)"));
	}
	const manifest=JSON.parse(files["host-object-manifest.json"]);
	assert.deepEqual(manifest.resources[0].targets,Object.keys(names));
	assert.equal(manifest.resources[0].declarations[0].receiver,"borrow, lifetime call");
	assert.equal(manifest.handleTransport.public,false);
	for(const targets of [["cargo"],["c","c"],["wasi"],["C++"],[]])
	{
		ir.types[0].host.targets=targets;
		assert.throws(()=>validateBindingIr(ir));
		await assert.rejects(assertJsonSchema("binding-ir",ir));
		assert.notEqual(await jsonSchemaErrors(v4,ir.types[0].host),null);
	}
});
