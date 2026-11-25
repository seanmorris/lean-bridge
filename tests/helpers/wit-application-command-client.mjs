/** @file Compile an independent application using only a release's public WIT files. */
import assert from "node:assert/strict";
import {cp,mkdir,mkdtemp,readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";
import {buildWitApplicationTemplate,compileWitApplicationCommand} from "../../src/build/wit-application-template.mjs";
import {compileWitAsyncPeer} from "../../src/build/wit-async-peer-package.mjs";
import {canonicalWasmtimeIdentity} from "../../src/release/wit-canonical-package.mjs";
import {addWitFunctionClient} from "./wit-application-project.mjs";

/**
 * The app provider extends its own registration interface with a constructor.
 * No fixture hook, private exchange export or native scheduler enters the guest.
 *
 * @param o - Public WIT directory, downstream area, wasm-tools and subprocess runner.
 * @param o.wit - Published public WIT directory.
 * @param o.out - Isolated downstream compilation directory.
 * @param o.wasm - Pinned wasm-tools executable.
 * @param o.run - Checked process runner.
 * @param [o.functions] - Require and exercise the package's binding-owned functions.
 */
export const buildInstalledWitGuests=async({wit,out,wasm,run,functions=false})=>{
	const fixtures=resolve("tests/fixtures/static-host-workers"),pkg="lean-bridge:workshop/",version="@1.0.0";
	const contract=await readFile(join(wit,"deps/objects.wit"),"utf8");
	const [,objectPackage]=/^package ([^;]+)@1\.0\.0;/u.exec(contract)??[];
	assert.ok(objectPackage);const obj=objectPackage+"/objects"+version,calls=pkg+"callbacks"+version,ops=pkg+"api"+version;
	await mkdir(out,{recursive: true});await cp(wit,join(out,"app-wit"),{recursive: true});
	const save=(file,value)=>writeFile(join(out,file),value);
	const consumer=f=>readFile(join(fixtures,f+".wat.in"),"utf8");
	const cli=(...args)=>run(wasm,args,out);
	const build=async(id,world,code)=>{
		await save(id+".wat",code);await cli("component","embed","app-wit","--world",world,id+".wat","-o",id+".core");
		await cli("component","new",id+".core","-o",id+".wasm");
	};
	const c=await readFile(join(wit,"callbacks.wit"),"utf8");
	assert.ok(c.includes("resource %call-box-to-box {"));
	await save("app-wit/callbacks.wit",c.replace("resource %call-box-to-box {","resource %call-box-to-box { make: static func(mode: u32) -> own<%call-box-to-box>;"));
	await save("owner.wat",(await consumer("guest-box")).replaceAll("@IFACE@",witCoreInterface(obj)));
	await cli("component","embed","app-wit/deps/objects.wit","--world","owner","owner.wat","-o","owner.core");
	await cli("component","new","owner.core","-o","owner.wasm");
	let cbSource=await consumer("guest-callback");
	if(functions)cbSource=cbSource.replace(";; @test-callback-import@",`(import "cm32p2|@OPS@" "remember" (func $capture (param i32 i32)))
    (import "cm32p2|@OPS@" "[method]remember-function.invoke" (func $invoke-fn (param i32 i32 i32)))
    (import "cm32p2|@OPS@" "remember-function_drop" (func $drop-fn (param i32)))
    (import "cm32p2|@IFACE@" "same-box" (func $same-box (param i32 i32) (result i32)))`)
		.replace(";; @test-callback-visit@",`(call $capture (local.get $box) (i32.const 24))
    (if (i32.load8_u (i32.const 24)) (then unreachable))
    (call $invoke-fn (i32.load (i32.const 28)) (local.get $box) (i32.const 48))
    (if (i32.load8_u (i32.const 48)) (then unreachable))
    (if (i32.eqz (call $same-box (local.get $box) (i32.load (i32.const 52)))) (then unreachable))
    (call $end (i32.load (i32.const 52))) (call $drop-fn (i32.load (i32.const 28)))`);
	await build("provider","registrations",cbSource.replaceAll("@CALLS@",witCoreInterface(calls))
		.replaceAll("@IFACE@",witCoreInterface(obj)).replaceAll("@OPS@",witCoreInterface(ops)));
	await cli("component","targets",wit,"--world","registrations","provider.wasm");
	const app=(await consumer("installed-application")).replaceAll("@OBJECTS@",obj).replaceAll("@CALLBACKS@",calls).replaceAll("@TASKS@",pkg+"object-tasks"+version);
	await save("app.wat",app);await cli("parse","app.wat","-o","application.wasm");
	await cli("component","targets","app-wit","--world","application","application.wasm");
	const template=await consumer("lean-consumer");
	const syncClient=(functions?await addWitFunctionClient(template):template).replaceAll("@IFACE@",witCoreInterface(obj)).replaceAll("@OPS@",witCoreInterface(ops))
		.replace(";; @worker-observers@",`(import "cm32p2|${witCoreInterface(ops)}" "cursor-counts" (func $counts (result i64))) (import "cm32p2|${witCoreInterface(ops)}" "cursor-gate" (func $gate (param i32) (result i32)))`);
	const suite=syncClient.replace(";; @installed-drop-checks@",`(drop (call $gate (i32.const 0))) (call $expect (i64.eqz (call $counts)))
        (call $expect (i32.eq (call $exercise (i32.const 42) (i32.const 73)) (i32.const 73)))
        (call $expect (i32.eq (call $exercise (i32.const -1) (i32.const -2)) (i32.const 105)))
        (call $expect (i32.eq (call $exercise (i32.const -2) (i32.const -1)) (i32.const 111)))`);
	await build("sync-suite","application",suite);
	await cli("component","targets",wit,"--world","application","sync-suite.wasm");
	const malformed=syncClient.replace(";; @installed-drop-checks@","(call $probe-invalid) unreachable");
	assert.notEqual(malformed,syncClient);
	await build("bad-argument","application",malformed);
	await cli("component","targets",wit,"--world","application","bad-argument.wasm");
	const early=app.replace("(then (return (call $read)))","(then (call $ds (global.get $r)) (call $del (global.get $s)) (call $box (global.get $orig)) (call $return (i64.const 17)) (return (i32.const 0)))");
	const trap=app.replace("(call $register (i32.const 0))","(call $register (i32.const 2))");
	assert.notEqual(early,app);assert.notEqual(trap,app);
	for(const [id,code] of [["early",early],["trap",trap]])
	{
		await save(id+".wat",code);await cli("parse",id+".wat","-o",id+".wasm");await cli("component","targets",join(out,"app-wit"),"--world","application",id+".wasm");
	}
	await save("private.wat",app.replace("(component",'(component (import "turn-series" (func (param "op" u32) (param "key" u32) (param "value" u64) (result (tuple u32 u32 u64 u64))))'));
	await cli("parse","private.wat","-o","private.wasm");await cli("validate","--features","cm-async,cm-async-builtins","private.wasm");
	await save("private-scheduler.wat",app.replace("(component",`(component (import "${pkg}scheduler${version}" (instance))`));
	await cli("parse","private-scheduler.wat","-o","private-scheduler.wasm");
	await cli("validate","--features","cm-async,cm-async-builtins","private-scheduler.wasm");
	return ["owner.wasm","provider.wasm","application.wasm"].map(path=>join(out,path));
};

/**
 * Link positive and negative downstream components without using the private
 * worker caller. Run the real release launcher against those same guest inputs.
 *
 * @param o - Full compiled worker, pinned wasm-tools and subprocess runner.
 */
export const exerciseMixedWitComposition=async o=>{
	const {app,b,wasm,run,sdk,runtimeRoot}=o,out=await mkdtemp(join(app,"mixed-")),client=join(out,"consumer");
	const common={app,out,b,name: "workshop",version: "1.0.0",wasm,run};
	const template=await buildWitApplicationTemplate(common);
	assert.equal(template.transport,"lean-bridge:workshop/scheduler@1.0.0");
	assert.deepEqual(template.roles,["objects","callbacks","application"]);
	assert.deepEqual(template.methods.map(m=>m.declaration).sort(),b.entries.filter(e=>e.delivery).map(e=>e.declaration).sort());
	const paths=await buildInstalledWitGuests({out: client,wit: join(out,"wit"),wasm,run});
	const header=size=>{
		const bytes=[4];do
		{bytes.push((size&127)|(size>127?128:0));size>>>=7;}while(size);
		return Buffer.from(bytes);
	};
	const graph=async(id,slots)=>{
		const guests=await Promise.all(slots.map(p=>readFile(p)));
		const bytes=template.parts.flatMap((part,i)=>i===guests.length?[part]:[part,header(guests[i].length),guests[i]]);
		await writeFile(join(out,id),Buffer.concat(bytes));
		return run(wasm,["validate","--features","cm-async,cm-async-builtins",id],out);
	};
	await graph("public.wasm",paths);
	const binary=await compileWitApplicationCommand({...common,template,cc: process.env.CC??"cc",sdk,runtimeRoot});
	const command=join(out,binary),env={PATH: "/no-tools",LEAN_NUM_THREADS: "1",RAYON_NUM_THREADS: "1",LD_LIBRARY_PATH: [app,join(sdk,"lib"),join(runtimeRoot,"lib")].join(":")};
	assert.equal((await run(command,paths,client,env)).stdout.trim(),"73","release launcher must execute the downstream program");
	const guest=file=>[...paths.slice(0,2),join(client,file+".wasm")];
	assert.equal((await run(command,guest("sync-suite"),client,env)).stdout.trim(),"1");
	assert.equal((await run(command,guest("early"),client,env)).stdout.trim(),"17");
	await assert.rejects(run(command,guest("bad-argument"),client,env),e=>/invalid WIT argument or conversion limit: shift/u.test(e.details?.stderr??e.stderr));
	await assert.rejects(run(command,guest("trap"),client,env),e=>/unreachable/u.test([e.message,e.details?.stderr,e.stderr].join(" ")));
	await assert.rejects(run(command,[...paths.slice(0,2),join(client,"private.wasm")],client,env),e=>/turn-series/u.test([e.message,e.details?.stderr,e.stderr].join(" ")));
	await assert.rejects(run(command,guest("private-scheduler"),client,env),e=>[e.message,e.details?.stderr,e.stderr].join(" ").includes(template.transport));
	await assert.rejects(graph("private.wasm",[...paths.slice(0,2),join(client,"private.wasm")]),e=>
		/turn-series/u.test([e.message,e.details?.stderr,e.stderr].join(" ")));
	const peer=await compileWitAsyncPeer({...common,template,sdk,runtimeRoot,cc: process.env.CC??"cc",sdkIdentity: canonicalWasmtimeIdentity});
	await mkdir(join(out,"lib"));await cp(join(out,peer.plugin),join(out,"lib",peer.plugin));
	const invoke=(args,dirs=[out])=>run(join(out,peer.runner),[...dirs,"--",...args],client,env);
	assert.equal((await invoke(paths)).stdout.trim(),"73");
	assert.equal((await invoke(guest("early"))).stdout.trim(),"17");
	await assert.rejects(invoke(guest("trap")),e=>/unreachable/u.test(e.details?.stderr??e.stderr));
	await assert.rejects(invoke(paths,[out,out]),e=>/duplicate WIT package interface/u.test(e.details?.stderr??e.stderr));
};
