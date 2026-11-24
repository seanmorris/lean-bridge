/** @file Exercise the owner-side host wrapper index using two separately linked pthread DSOs. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {generateOwnedWasmBroker} from "../../src/backends/javascript/owned-wasm-broker.mjs";
import {prepareTaskSdk} from "../../src/build/javascript-wasm-task-sdk.mjs";
import {javascriptWasmTargetHeaders} from "../../src/build/javascript-wasm-toolchain.mjs";
import {readTaskInputs} from "../../src/release/javascript-wasm-task-inputs.mjs";

const run=promisify(execFile);
test("a Lean worker retains canonical JS host identity across components and retirement",async t=>{
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
	for(const op of ["wrap","token","admit","collect","retire"])
		assert.ok(exported.some(e=>e.name==="lb_jst_"+op+"_v1" && e.kind==="function"),"missing host identity operation: "+op);
	await mkdir(join(cwd,"include/lean"),{recursive: true});
	for(const name of javascriptWasmTargetHeaders) await writeFile(join(cwd,"include/lean",name),files.get(name));
	await writeFile(join(cwd,"include/lean_bridge_native_runtime.h"),generateOwnedWasmBroker().header);
	const fixture=resolve("tests/fixtures/javascript-threaded-host"), options={cwd,env,timeout: 120000};
	await copyFile(join(fixture,"Identity.lean"),join(cwd,"Identity.lean"));
	await run(join(env.LEAN_BRIDGE_LEAN_PREFIX,"bin/lean"),["-j1","-c","lean-identity.c","Identity.lean"],options);
	for(const id of ["A","B"])
	{
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
			, "lean-identity.c"
			, join(fixture,"identity.c")
			, "-o"
			, id+".wasm"],options);
	}
	const {stdout}=await run(process.execPath,[join(fixture,"owner.mjs"),resolve(kit),cwd],{cwd,env,timeout: 45000});
	assert.match(stdout,/worker identity and retirement verified/u);
});
