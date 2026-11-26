/** @file Zend objects can only cross through their own interpreter's nominal table. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {promisify} from "node:util";
import {phpWasmObjectDomain} from "../src/backends/php/php-wasm-task-objects.mjs";
import {phpWasmMemberOwner} from "../src/backends/php/php-wasm-member-owner.mjs";
import {phpTaskFunctions} from "../src/backends/php/php-wasm-task-leases.mjs";
import {writePhpTaskValue} from "../src/backends/php/php-wasm-task-wire.mjs";
import {generatePhpWasmTaskFiles} from "../src/backends/php/php-wasm-task-files.mjs";
import {nativeHostSelection,reconcileHostExports} from "../src/analyze/host-export-model.mjs";
import {javaScriptTaskAbi} from "../src/abi/javascript-wasm-tasks.mjs";
import {javaScriptHostIOAbi} from "../src/abi/component-host-io.mjs";
import {generateJavaScriptHostExports} from "../src/backends/javascript/host-wasm-exports.mjs";

test("Zend cursor cancellation returns before its native worker drains", async () => {
	const php = process.env.LEAN_BRIDGE_PHP ?? "php";
	const {stdout,stderr} = await promisify(execFile)(php,["tests/fixtures/php-wasm-task-owner/cursor-cancel-state.php"]);
	assert.equal(stderr,"");
	assert.match(stdout,/fault precedence and one drain passed/u);
});

test("Zend root collection drains the old generation when a PHP destructor reenters and throws", async t => {
	const php = process.env.LEAN_BRIDGE_PHP ?? "php";
	try
{
		const {stdout, stderr} = await promisify(execFile)(php, ["tests/fixtures/php-wasm-task-owner/closure-roots.php"]);
		assert.equal(stderr, "");
		assert.match(stdout, /PHP retained only the native capture; sibling identity, interpreter isolation and final release passed/u);
} catch(error)
{
		if(error.code === "ENOENT" && !process.env.LEAN_BRIDGE_PHP) return t.skip("PHP CLI is not installed");
		throw error;
}
});

test("Zend factories authenticate a distinct owner before PHP projects the invokable",async()=>{
	const ir=JSON.parse(await readFile(new URL("./fixtures/ruby-host-meter/lean-bridge.hosts.json",import.meta.url)));
	ir.types[0].host.targets=["php"];
	const module="LeanBridge.Host.Php",box={kind: "named",id: ir.types[0].id};
	const first="Workshop.remember",future="Workshop.echo",read=module+".Box.read",policy="native-host-io-v1";
	const selection={...nativeHostSelection(ir,"php"), exports: [first,future]
		, exportModules: ["Workshop"]
		, modules: ["Workshop",module]
		, nativeEffectPolicy: policy
		, nativeEffects: []
		, taskExports: [future]
		, asyncIterators: []
		, phpWasmTaskObjects: true
		, phpTaskCallbacks: true};
	const metadata={kind: "lean-bridge-host-export-metadata"
		, schemaVersion: 1
		, leanVersion: "4.32.2"
		, entries: [
		{declaration: first,module: "Workshop",parameters: [{name: "x",type: box}],result: {kind: "io-closure",argument: box,reply: box},effect: "IO",hostMembers: [read]}
		, {declaration: future,module: "Workshop",parameters: [{name: "x",type: box}],result: box,effect: "BaseIO",delivery: "task",hostMembers: []}
		]
	, nativeEffectAudit: {policy,initializers: [],roots: [{declaration: first,leaves: [{name: read,module,symbol: "lean_bridge_host_php_box_read"}]},{declaration: future,leaves: []}]}};
	const component={name: "workshop",id: "workshop@1.0.0",version: "1.0.0"};
	const {api}=reconcileHostExports({component,ir,selection,metadata}),identity="a".repeat(64);
	const site=api.types.find(t=>t.kind==="callback");
	assert.equal(site.source.extensions["lean-bridge.dev/closure-owner"],"php-wasm-zend-binding");
	assert.deepEqual(site.callable.failure.errors,["error:IO.Error","error:PhpHostException"]);
	assert.throws(()=>javaScriptTaskAbi(api,identity,ir,false));
	const {php}=await generatePhpWasmTaskFiles(api,identity,{name: "example/workshop",version: "1.0.0"},api,ir);
	assert.match(php["src/Api.php"],/final class RememberFunction extends Internal\\BoundFunction/u);
	assert.match(php["src/BoundApi.php"],/function remember\(object \$x\): RememberFunction/u);
	assert.match(php["src/BoundApi.php"],/WeakReference::create\(\$this\)/u);
	const immediate={...selection,exports: [first],phpWasmSyncObjects: true};
	for(const k of ["phpWasmTaskObjects","phpTaskCallbacks","taskExports"])delete immediate[k];
	const syncMeta={...metadata,entries: metadata.entries.slice(0,1)
		, nativeEffectAudit: {...metadata.nativeEffectAudit,roots: metadata.nativeEffectAudit.roots.slice(0,1)}};
	const apiFor=selection=>reconcileHostExports({component,ir,selection,metadata: syncMeta}).api;
	const sync=apiFor(immediate),abi=javaScriptHostIOAbi(sync,ir,identity,true);
	assert.equal(abi.owner,"php-wasm-zend");assert.equal(abi.methods.length,1);
	const {entryLean}=generateJavaScriptHostExports({api: sync,hosts: ir,identity,modules: ["Workshop"],phpWasm: true});
	assert.match(entryLean,/^import LeanBridge\.Host\.Php$/mu);
	assert.doesNotMatch(entryLean,/LeanBridge\.Host\.Javascript/u);
	assert.throws(()=>javaScriptHostIOAbi(sync,ir,identity));assert.throws(()=>javaScriptTaskAbi(sync,identity,ir,true));
	for(const changed of [{phpWasmTaskObjects: true},{phpNativeFunctions: true},{nativeEffects: ["filesystem"]},{taskExports: [first]}])
		assert.throws(()=>apiFor({...immediate,...changed}),/synchronous Zend owner/u);
	const standalone=await generatePhpWasmTaskFiles(sync,identity,{name: "example/workshop",version: "1.0.0"},sync,ir,true);
	assert.equal(standalone.php["src/Delivery.php"],undefined);
	assert.doesNotMatch(standalone.php["src/BoundApi.php"],/vrzno_await|Pump::read/u);
	assert.match(standalone.files["index.mjs"],/createPhpZendSyncDescriptor/u);
	assert.doesNotMatch(standalone.files["index.mjs"],/loadTaskComponent/u);
	for(const bad of ["php-host-binding","javascript-host-binding"])
{
		site.source.extensions["lean-bridge.dev/closure-owner"]=bad;
		assert.throws(()=>javaScriptTaskAbi(api,identity,ir,true));
}
});

test("a PHP binding owns its returned functions even when two bindings share the component",()=>{
	const kind="lease:"+"a".repeat(64),method={result: kind,returnedFunction: {}},events=[];
	const make=(id,fail=false)=>Object.assign(v=>[id,v],{dispose: ()=>{events.push(id);if(fail) throw new Error(id);}});
	const bind=()=>phpTaskFunctions([method],(m,fn)=>{assert.equal(m,method);return fn;});
	const a=bind(),b=bind();
	const deliver=(group,id,fail=false)=>{
		const p=group.packet("value",kind,make(id,fail));assert.equal(p.claim("wrong"),null);
		const cap=p.claim(kind);assert.equal(p.claim(kind),null);p.discard();return cap;
	};
	const x=deliver(a,"x",true),y=deliver(a,"y"),z=deliver(b,"z");
	const p=a.packet("value",kind,make("undelivered"));p.discard();p.discard();assert.equal(p.claim(kind),null);
	assert.deepEqual(x.run(13),["x",13]);assert.throws(()=>a.revoke(),/x/u);
	assert.equal(x.run(13),'["fault"]');assert.equal(y.close(),false);assert.deepEqual(z.run(4),["z",4]);
	assert.throws(()=>a.packet("value",kind,make("late")),/inactive/iu);
	assert.throws(()=>b.packet("worker",kind,make("bad")),/factory/iu);
	assert.ok(z.close());b.revoke();a.revoke();
	assert.deepEqual(events,["undelivered","x","y","late","bad","z"]);
});

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

test("independent interpreters share nominal prototypes but cannot redeem each other's objects",()=>{
	const pool=new Map(),kind="host:"+"d".repeat(64);
	const left=phpWasmObjectDomain([kind],pool),right=phpWasmObjectDomain([],pool);
	right.register(kind);right.register(kind);
	assert.equal(left.classFor(kind),right.classFor(kind));assert.notEqual(left.id,right.id);
	const cap=right.mint(kind),mirror=right.borrow(kind,cap);
	assert.ok(mirror instanceof left.classFor(kind));
	assert.throws(()=>left.borrow(kind,cap),TypeError);assert.throws(()=>left.packet("value",kind,mirror),TypeError);
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
