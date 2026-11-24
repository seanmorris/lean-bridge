/** @file Zend objects can only cross through their own interpreter's nominal table. */
import assert from "node:assert/strict";
import test from "node:test";
import {phpWasmObjectDomain} from "../src/backends/php/php-wasm-task-objects.mjs";
import {phpWasmMemberOwner} from "../src/backends/php/php-wasm-member-owner.mjs";
import {writePhpTaskValue} from "../src/backends/php/php-wasm-task-wire.mjs";

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

test("synchronous Zend member tickets stay with their call and cannot name another scope's exception",()=>{
	const key="a".repeat(64),kind="host:"+key,domain=phpWasmObjectDomain([kind]);
	const model={zend: true,kinds: [{key}],members: [{args: [0],result: "uint32"},{args: ["uint32"],result: 0}]};
	const cap=domain.mint(kind),box=domain.borrow(kind,cap),owner=phpWasmMemberOwner(model,domain);
	const invalid=e=>{throw e;},trap=()=>assert.fail("unexpected transport trap");
	const send=(slot,args)=>owner.send(slot,args,invalid,trap);
	assert.throws(()=>send(0,[box]),/outside its owner/u);
	const n=writePhpTaskValue("uint32",4294967295)[1];
	assert.equal(owner.enter((slot,arg)=>{assert.equal(slot,0);assert.equal(arg,cap.key());return "v"+n;},()=>send(0,[box])),4294967295);
	assert.equal(owner.enter((slot,arg)=>{assert.equal(slot,1);assert.equal(arg,n);return cap;},()=>send(1,[4294967295])),box);
	owner.enter(()=>"e1",restore=>{
		let outer,inner;
		try
{send(0,[box]);} catch(e)
{outer=e;}
		owner.enter(()=>"b1",nested=>{
			try
{send(0,[box]);} catch(e)
{inner=e;}
			assert.equal(nested(inner),'["member",1]');assert.equal(nested(outer),null);
		});
		assert.equal(restore(outer),'["member",1]');assert.equal(restore(inner),null);
	});
	const fault=new WebAssembly.RuntimeError("broken Zend transport");
	assert.throws(()=>owner.enter(()=>{throw fault;},()=>owner.send(0,[box],invalid,e=>{assert.equal(e,fault);throw e;})),e=>e===fault);
	assert.throws(()=>send(0,[box]),/outside its owner/u);
});
