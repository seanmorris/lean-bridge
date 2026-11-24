/** @file Exercise the owner-side host wrapper index using two separately linked pthread DSOs. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {generateOwnedWasmBroker} from "../../src/backends/javascript/owned-wasm-broker.mjs";
import {generateJavaScriptHostExterns} from "../../src/backends/javascript/host-wasm-externs.mjs";
import {generateLeanHostObjectAdapters} from "../../src/backends/lean/host-object.mjs";
import {prepareTaskSdk} from "../../src/build/javascript-wasm-task-sdk.mjs";
import {javascriptWasmTargetHeaders} from "../../src/build/javascript-wasm-toolchain.mjs";
import {readTaskInputs} from "../../src/release/javascript-wasm-task-inputs.mjs";
import {assertWasmSideImports} from "../../src/release/owned-javascript-npm-package.mjs";
import {checkThreadedHostBrowsers} from "./javascript-threaded-host-browsers.mjs";
import {addHostProbeMembers} from "./javascript-host-generated.mjs";

const execute=promisify(execFile);
const run=async (...args)=>{
	try
	{return await execute(...args);}
	catch(error)
	{throw new Error([error.cmd,error.stdout,error.stderr].filter(Boolean).join("\n").split("\n").filter(line=>line.length<1500).join("\n").slice(-6000),{cause: error});}
};
test("real Lean pthreads preserve JavaScript host identity, member results, exceptions and retirement",async t=>{
	const cwd=await mkdtemp(join(tmpdir(),"threaded-host-identity-"));
	t.after(()=>rm(cwd,{recursive: true,force: true}));
	const sdk=resolve(process.env.LEAN_BRIDGE_JS_EMSDK), env={...process.env,EMSDK: sdk,EM_CONFIG: join(sdk,".emscripten"),EMCC_CORES: "1",BINARYEN_CORES: "1"};
	const kit=process.env.LEAN_BRIDGE_TEST_TASK_INPUTS ?? join(cwd,"kit");
	if(!process.env.LEAN_BRIDGE_TEST_TASK_INPUTS) await prepareTaskSdk({
		outputRoot: kit
		, emsdkRoot: sdk
		, leanRuntimeRoot: env.LEAN_BRIDGE_JS_THREAD_CORE
		, initArchive: env.LEAN_BRIDGE_JS_THREAD_INIT
		, environment: env});
	const {files}=await readTaskInputs(kit);
	const exported=WebAssembly.Module.exports(await WebAssembly.compile(files.get("task.wasm")));
	for(const op of ["wrap","token","admit","collect","retire","member","run_member","error_ticket"])
		assert.ok(exported.some(e=>e.name==="lb_jst_"+op+"_v1" && e.kind==="function"),"missing host identity operation: "+op);
	assert.ok(!exported.some(e=>e.name==="bridge_scalar_call" || e.name.startsWith("bridge_callable_")));
	await mkdir(join(cwd,"include/lean"),{recursive: true});
	for(const name of javascriptWasmTargetHeaders) await writeFile(join(cwd,"include/lean",name),files.get(name));
	await writeFile(join(cwd,"include/lean_bridge_native_runtime.h"),generateOwnedWasmBroker().header);
	const fixture=resolve("tests/fixtures/javascript-threaded-host"), options={cwd,env,timeout: 120000};
	const ir=JSON.parse(await readFile(resolve("tests/fixtures/javascript-host-meter/lean-bridge.hosts.json")));
	addHostProbeMembers(ir);
	const host="LeanBridge/Host/Javascript";
	await mkdir(join(cwd,"LeanBridge/Host"),{recursive: true});
	await writeFile(join(cwd,host+".lean"),generateLeanHostObjectAdapters(ir,{threadedJavaScript: true})[host+".lean"]);
	await copyFile(join(fixture,"Members.lean"),join(cwd,"Members.lean"));
	const lean=join(env.LEAN_BRIDGE_LEAN_PREFIX,"bin/lean");
	const leanEnv={...options,env: {...env,LEAN_PATH: cwd}};
	await run(lean,["-j1","-o",host+".olean","-c","host.c",host+".lean"],leanEnv);
	for(const [dir,module] of [["javascript-host-meter","Workshop"],["javascript-host-wasm","GeneratedProbe"]])
{
		const input=await readFile(resolve("tests/fixtures",dir,module+".lean"),"utf8");
		// These test modules normally use the full Init archive; the pthread
		// fixture imports the same declarations through its explicit prelude.
		await writeFile(join(cwd,module+".lean"),"prelude\n"+input);
		await run(lean,["-j1","-o",module+".olean","-c",module+".c",module+".lean"],leanEnv);
}
	await run(lean,["-j1","-c","members-lean.c","Members.lean"],leanEnv);
	await copyFile(join(fixture,"Identity.lean"),join(cwd,"Identity.lean"));
	await run(join(env.LEAN_BRIDGE_LEAN_PREFIX,"bin/lean"),["-j1","-c","lean-identity.c","Identity.lean"],options);
	const link=async (id,extra,objects)=>{
		const symbol="lb_jst_test_"+id;
		await run(join(sdk,"upstream/emscripten/emcc"),["-O2"
			, "-g0"
			, "-fPIC"
			, "-pthread"
			, "-fvisibility=hidden"
			, "-fwasm-exceptions"
			, "-DLEAN_EMSCRIPTEN"
			, "-DLEAN_MULTI_THREAD"
			, "-Iinclude"
			, "-DLB_TEST_CONTROL="+symbol
			, "-sSIDE_MODULE=2"
			, "-Wl,--no-entry"
			, "-Wl,--fatal-warnings"
			, "-Wl,--export="+symbol
			, ...extra
			, ...objects
			, "-o"
			, id+".wasm"],options);
		const side=await WebAssembly.compile(await readFile(join(cwd,id+".wasm")));
		const keys=entries=>new Set(entries.map(e=>e.kind+":"+e.name));
		assertWasmSideImports({side,runtimeExports: keys(exported),sideExports: keys(WebAssembly.Module.exports(side)),profile: "task"});
	};
	for(const id of ["A","B"]) await link(id,[],["lean-identity.c",join(fixture,"identity.c")]);
	for(const [id,digest] of [["C","c".repeat(64)],["D","d".repeat(64)]])
{
		const gen=generateJavaScriptHostExterns(ir,digest,{threaded: true});
		await writeFile(join(cwd,"renames.h"),gen.renames);
		await writeFile(join(cwd,"externs.c"),gen.source);
		await writeFile(join(cwd,"model.json"),JSON.stringify(gen.model));
		await link(id,["-I.","-include","renames.h"],["host.c","Workshop.c","GeneratedProbe.c","externs.c",join(fixture,"members.c")]);
}
	const {stdout}=await run(process.execPath,[join(fixture,"owner.mjs"),resolve(kit),cwd],{cwd,env,timeout: 45000});
	assert.match(stdout,/worker identity and retirement verified/u);
	const result=await run(process.execPath,[join(fixture,"member-owner.mjs"),resolve(kit),cwd],{cwd,env,timeout: 45000});
	const count=Number(/threaded member calls verified: (\d+)/u.exec(result.stdout)?.[1]);
	assert.ok(count>30);t.diagnostic(JSON.stringify({node: count,...await checkThreadedHostBrowsers(cwd,kit,count)}));
});
