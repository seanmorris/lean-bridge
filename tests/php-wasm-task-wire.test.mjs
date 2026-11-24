/** @file Exercise the PHP task boundary independently of a compiler or a running worker. */
import assert from "node:assert/strict";
import test from "node:test";
import {readPhpTaskValue,writePhpTaskValue} from "../src/backends/php/php-wasm-task-wire.mjs";
import {createPhpTaskDescriptor} from "../src/backends/php/php-wasm-task-owner.mjs";
import {createPhpCallbackHub,createPhpCallbackMailbox} from "../src/backends/php/php-wasm-task-mailbox.mjs";

test("PHP callback requests are owner-local, one-shot and revoked on completion",async()=>{
	const hub=createPhpCallbackHub(),box=createPhpCallbackMailbox([[3,"uint32","string"]],hub);
	const next=box.next();
	const waiting=box.request(3,9);
	const [tag,key,ticket,slot,bytes]=JSON.parse(await next);assert.equal(key,box.key);
	assert.equal(tag,"call");assert.equal(slot,3);assert.equal(readPhpTaskValue("uint32",bytes),9);
	assert.equal(box.answer(ticket+1,true,""),false);
	assert.equal(box.answer(ticket,true,writePhpTaskValue("string","a\0λ")[1]),true);
	assert.equal(await waiting,"a\0λ");assert.equal(box.answer(ticket,false,""),false);
	const failed=box.request(3,11), [,,id]=JSON.parse(await box.next());
	assert.equal(box.answer(id,false,"",s=>new Error(s)),true);
	const marker=await failed.catch(e=>e);
	const jsError=cause=>({code: "error:JavaScriptCallbackError",cause});
	assert.equal(box.failure(jsError(marker)),JSON.stringify(["throw",id]));
	assert.equal(box.failure(jsError(new Error(marker.message))),null);
	const other=createPhpCallbackMailbox([[3,"uint32","string"]],hub);assert.equal(other.failure(jsError(marker)),null);
	const late=box.request(3,12),[,owner,last]=JSON.parse(await other.next());
	assert.equal(owner,box.key);
	box.finish('["cancelled"]');await assert.rejects(late,/closed/u);
	assert.equal(box.answer(last,true,""),false);assert.equal(await box.next(),'["cancelled"]');
	box.finish('["fault"]');assert.equal(await box.next(),'["cancelled"]');
});

test("a malformed success or exception packet settles the waiting callback and cancels only its task",async()=>{
	for(const ok of [true,false])
{
		const hub=createPhpCallbackHub(),box=createPhpCallbackMailbox([[0,"uint8","uint8"]],hub);
		const pending=box.request(0,1);const [,,ticket]=JSON.parse(await box.next());let stops=0;
		const refused=assert.rejects(pending);
		assert.equal(box.answer(ticket,ok,"!",message=>new Error(message),()=>{stops++;}),false);
		await refused;assert.equal(await box.next(),'["fault"]');assert.equal(stops,1);
		assert.equal(box.answer(ticket,ok,"!",null,()=>{stops++;}),false);assert.equal(stops,1);
		const good=createPhpCallbackMailbox([[0,"uint8","uint8"]],hub),sibling=good.request(0,1);
		const [,,next]=JSON.parse(await good.next());
		assert.equal(good.answer(next,true,writePhpTaskValue("uint8",2)[1]),true);assert.equal(await sibling,2);
}
});

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

test("only branded capabilities can be borrowed; abandoning an undelivered result releases exactly once",async()=>{
	const key="lease:"+"a".repeat(64),leases=[{name: "Ticket",type: key}];
	const runtime=()=>{},a={shared: {}},b={shared: {}};let owners=0;
	/** Count the underlying owners independently of the transport's JS wrappers. */
	class Ticket
{
		/** Acquire a new test owner. */
		constructor(){owners++;this.disposed=false;}
		/** Release the underlying owner at most once. */
		dispose(){if(this.disposed) return false;this.disposed=true;owners--;return true;}
}
	const def=(key,namespace,name,args,result,delivery)=>({key,namespace,leases,methods: [{name,args,result,delivery}]});
	const descriptor=createPhpTaskDescriptor(def("a","Maker","make",[],key),{Ticket,make: ()=>new Ticket()},[],runtime);
	descriptor.getFiles(a);descriptor.getFiles(b);
	const reader=createPhpTaskDescriptor(def("b","Reader","check",[key],"bool"),{Ticket,check: ()=>true},[],runtime);
	reader.getFiles(a);reader.getFiles(b);
	const p=a.shared.a_0();assert.equal(p.claim("lease:other"),null);const cap=p.claim(key);
	assert.equal(p.claim(key),null);p.discard();assert.equal(owners,1);
	assert.notEqual(a.shared.b_0(cap),'["fault"]');assert.equal(b.shared.b_0(cap),'["fault"]');
	assert.equal(a.shared.b_0(Object.create(cap)),'["fault"]');
	assert.equal(cap.close(),true);assert.equal(cap.close(),false);
	assert.equal(a.shared.b_0(cap),'["fault"]');assert.equal(owners,0);
	let settle;
	createPhpTaskDescriptor(def("t","Later","next",[],key,"task"),{Ticket
	, next: ()=>{
		const job=Promise.withResolvers();settle=()=>job.resolve(new Ticket());return Object.assign(job.promise,{cancel: ()=>false});
	}},[],runtime).getFiles(a);
	const early=a.shared.t_0();early.abandon();settle();await early.result();assert.equal(owners,0);
	const ready=a.shared.t_0();settle();await ready.result();assert.equal(owners,1);ready.abandon();assert.equal(owners,0);
	const delivered=a.shared.t_0();settle();const taken=(await delivered.result()).claim(key);
	delivered.abandon();assert.equal(owners,1);taken.close();assert.equal(owners,0);
});
