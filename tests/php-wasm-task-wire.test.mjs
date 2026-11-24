/** @file Exercise the PHP task boundary independently of a compiler or a running worker. */
import assert from "node:assert/strict";
import test from "node:test";
import {readPhpTaskValue,writePhpTaskValue} from "../src/backends/php/php-wasm-task-wire.mjs";
import {createPhpTaskDescriptor} from "../src/backends/php/php-wasm-task-owner.mjs";

test("PHP task transport preserves exact copied values, byte strings, and chosen Except branches",()=>{
	const vectors={unit: undefined,bool: true,bytes: Uint8Array.of(0,255)
		, float32: -0,float64: NaN
		, uint8: 255,int8: -128,uint16: 65535,int16: -32768
		, uint32: 4294967295
		, int32: -2147483648
		, uint64: (1n<<64n)-1n
		, int64: -(1n<<63n)
		, usize: 4294967295
		, isize: -2147483648
		, nat: 1n<<223n,int: -(1n<<224n),char: "🌿",string: "\uFEFFλ\0🌿"};
	for(const [kind,v] of Object.entries(vectors))
{
		const [tags,wire]=writePhpTaskValue(kind,v);assert.equal(tags,"");assert.deepEqual(readPhpTaskValue(kind,wire),v,kind);
}
	const [tags,bits]=writePhpTaskValue([["uint8","int"],"string"],{ok: {error: -703n}});
	assert.equal(tags,"AQA=");assert.equal(readPhpTaskValue("int",bits),-703n);
	assert.throws(()=>writePhpTaskValue(["bool","string"],{ok: true,error: "x"}));
	assert.throws(()=>readPhpTaskValue("bool","AgAAAAAAAAA="));
	assert.throws(()=>readPhpTaskValue("unit","AAAAAA=="));
	assert.throws(()=>readPhpTaskValue("string","/w=="));
	assert.throws(()=>readPhpTaskValue("int","AQAAAAAAAAA="));
	assert.throws(()=>readPhpTaskValue("nat","AAAAAAAAAAAAAAAAAAAAAA=="));
});
test("the JS owner never sends a rejected promise or admits conflicting PHP bindings",async()=>{
	const methods=[{name: "work",delivery: "task",args: [],result: "uint8",startId: "error:EIO.test",error: "uint8",terminalId: "error:TaskIO.Error",terminal: "string"}];
	const error=Object.assign(new Error("worker refused"),{code: "error:TaskIO.Error",cause: {details: {errorId: "error:TaskIO.Error",payload: "message\0"}}});
	const runtime=()=>{}, host={shared: {}},descriptor=(key,work,r=runtime)=>createPhpTaskDescriptor({key,namespace: "LeanDemo",methods},{work},[],r);
	const a=descriptor("a",()=>Object.assign(Promise.reject(error),{cancel: ()=>false}));
	a.getFiles(host);a.getFiles(host);
	const owner=host.shared.a_0();assert.deepEqual(JSON.parse(await owner.result()),["worker","","bWVzc2FnZQA="]);assert.equal(owner.cancel(),false);
	assert.throws(()=>descriptor("b",()=>0).getFiles(host),/Conflicting/u);
	assert.throws(()=>descriptor("a",()=>0,()=>{}).getFiles(host),/Conflicting PHP-Wasm task runtimes/u);
	const broken={shared: {}};descriptor("b",()=>{throw new Error("unexpected");}).getFiles(broken);assert.equal(broken.shared.b_0(),'["fault"]');
	const wrong={shared: {a_0: 1}};assert.throws(()=>a.getFiles(wrong),/already installed/u);assert.equal(wrong.shared.a_0,1);
});
