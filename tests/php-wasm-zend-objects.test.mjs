/** @file Zend objects can only cross through their own interpreter's nominal table. */
import assert from "node:assert/strict";
import test from "node:test";
import {phpWasmObjectDomain} from "../src/backends/php/php-wasm-task-objects.mjs";

test("Zend worker keys cannot substitute for a live, matching capability",()=>{
	const a="host:"+"a".repeat(64),b="host:"+"b".repeat(64);
	const d=phpWasmObjectDomain([a,b]),f=phpWasmObjectDomain([a]);
	const cap=d.mint(a),other=d.mint(b),foreign=f.mint(a),mirror=d.borrow(a,cap);
	assert.equal(d.borrow(a,cap),mirror);assert.ok(mirror instanceof d.classFor(a));
	assert.notEqual(foreign.key(),cap.key());assert.equal(d.key(a,mirror),cap.key());
	for(const bad of [cap.key(),{},Object.create(d.classFor(a).prototype),other,foreign])
		assert.throws(()=>d.borrow(a,bad),TypeError);
	assert.throws(()=>d.key(a,Object.create(d.classFor(a).prototype)),TypeError);
	assert.throws(()=>f.key(a,mirror),TypeError);assert.throws(()=>new (d.classFor(a))(),TypeError);
	const out=d.packet("value",a,mirror);
	assert.equal(out.claim(b),null);assert.equal(out.claim(a),cap.key());assert.equal(out.claim(a),null);
	const dropped=d.packet("worker",a,mirror);dropped.discard();assert.equal(dropped.claim(a),null);
	assert.throws(()=>phpWasmObjectDomain([a,a]),TypeError);assert.throws(()=>phpWasmObjectDomain(["Box"]),TypeError);
});

test("a nested returned Except exposes only the active Zend object branch",()=>{
	const type="host:"+"c".repeat(64),domain=phpWasmObjectDomain([type]),cap=domain.mint(type);
	const shape=["uint32",[type,"string"]],obj=domain.borrow(type,cap);
	const packet=domain.tagged("value",shape,{error: {ok: obj}});
	assert.equal(packet.tags(),"01");assert.equal(packet.form(),"value");
	assert.equal(packet.claim(type),cap.key());assert.equal(packet.claim(type),null);
	assert.equal(domain.tagged("value",shape,{ok: 2}),null);
	assert.equal(domain.tagged("value",shape,{error: {error: "message"}}),null);
	for(const invalid of [{ok: 3,error: {}},{other: {}},{error: {ok: {}}},{error: {}}])
		assert.throws(()=>domain.tagged("value",shape,invalid),TypeError);
});
