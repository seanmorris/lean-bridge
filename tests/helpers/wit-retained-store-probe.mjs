/** @file Execute retained requests through Wasmtime's public component calls on the owning thread. */
import assert from "node:assert/strict";
import { cp,readFile,writeFile } from "node:fs/promises";
import { join,resolve } from "node:path";
import { snapshotWasmtimeCapi } from "../../src/build/native-wit-projection.mjs";
import { renderWitTaskImports } from "../../src/backends/wit/task-host.mjs";

/**
 * Link the actual generated queue and task adapter to the engine's store-local imports.
 *
 * @param input - Checked application, compiled world, pinned SDK, private directory and runner.
 * @param input.app - Private compile workspace.
 * @param input.model - Compiler-checked WIT and native entry points.
 * @param input.built - Lean-generated source objects and compiler environment.
 * @param input.runtimeRoot - Verified shared Lean runtime installation.
 * @param input.run - Bounded subprocess runner.
 * @param input.wasmtimeRoot - Pinned Wasmtime C SDK.
 */
export const exerciseRetainedStore=async({app,model,built,runtimeRoot,run,wasmtimeRoot})=>{
	assert.ok(wasmtimeRoot,"Set LEAN_BRIDGE_WASMTIME_C_API to the Wasmtime 42.0.1 C SDK");
	const sdk=join(app,"wasmtime");await snapshotWasmtimeCapi(wasmtimeRoot,sdk);
	const component=await readFile(join(app,"world.wasm")),imports=await renderWitTaskImports(model);
	await writeFile(join(app,"task-host.h"),imports+"\nstatic const uint8_t lb_task_component[]={"+Array.from(component).join(",")+"};\n",{flag: "wx"});
	await cp(resolve("tests/fixtures/wit-tasks/wasmtime-lab.h"),join(app,"wasmtime-lab.h"));
	await cp(resolve("tests/fixtures/wit-task-package/retained-store.c"),join(app,"store.c"));
	const {env,objects}=built,cc=env.CC??"cc",lib=join(runtimeRoot,"lib"), wasmtime=join(sdk,"lib");
	const include=["-I",join(runtimeRoot,"include"),"-I",join(sdk,"include")];
	await run(cc,["-std=gnu11","-O1","-g0",...include,"-Wall","-Wextra","-Werror","-c","store.c","-o","store.o"],app,env);
	await run(cc,["-std=gnu11","-O1","-g0",...include,...objects
		, "checked-entry.c","adapter.c","wire.c","store.o"
		, "-L"
		, lib
		, "-L"
		, wasmtime
		, "-lwasmtime"
		, "-llean_bridge_native"
		, "-lleanshared"
		, "-lm"
		, "-ldl"
		, "-pthread"
		, "-Wl,-z,defs,-z,now"
		, "-o"
		, "store"],app,env);
	const {stdout,stderr}=await run(join(app,"store"),[],app,{
		PATH: "/no-producer-tools"
		, LD_LIBRARY_PATH: [lib,wasmtime].join(":")
		, RAYON_NUM_THREADS: "1"
		, LEAN_NUM_THREADS: "1"});
	assert.equal(stderr,""); assert.match(stdout,/Wasmtime retained requests: .* passed/u);
	return stdout.trim();
};
