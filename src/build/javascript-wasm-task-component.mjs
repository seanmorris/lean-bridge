/** @file Compile freshly elaborated Lean task declarations into a private, threaded Wasm side module. */
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson, sha256} from "../capsule/node.mjs";
import {javaScriptTaskAbi} from "../abi/javascript-wasm-tasks.mjs";
import {taskWorkerInterface} from "../analyze/host-export-model.mjs";
import {generateCTaskExports} from "../backends/c/task-exports.mjs";
import {generateSyncWire} from "../backends/c/sync-wire.mjs";
import {generateOwnedWasmBroker} from "../backends/javascript/owned-wasm-broker.mjs";
import {generateTaskControl} from "../backends/javascript/task-control.mjs";
import {compileHostSources,threadedHostSource} from "./host-elaboration.mjs";
import {generateJavaScriptHostExterns} from "../backends/javascript/host-wasm-externs.mjs";
import {identifyJavaScriptWasmCompiler, javascriptWasmOwnedPins as pins, javascriptWasmTargetHeaders} from "./javascript-wasm-toolchain.mjs";
import {processBuildRunner} from "./process-runner.mjs";
import {taskStamp} from "../release/javascript-wasm-task-inputs.mjs";
import {wasmTaskLedgerHeader} from "./javascript-wasm-task-ledger.mjs";
export {threadedTaskPatch} from "../release/javascript-wasm-task-inputs.mjs";

const owner = `#include <emscripten/threading.h>
static int lb_context(void) { return emscripten_is_main_runtime_thread() && lean_bridge_native_process_valid(); }
`;
const sourceAsset = path => readFile(new URL("../backends/" + path, import.meta.url));

/**
 * Compile against the threaded profile, not the single-threaded IO runtime.
 * No project-provided native object, adapter, or handwritten signature is linked.
 *
 * @param options - Captured Lean sources, pinned SDK/core and a fresh private build directory.
 */
export const compileJavaScriptTaskComponent = async options => {
	const {app, projectContract: contract, leanPrefix, emsdkRoot: sdk, leanRuntimeRoot: target, environment, signal} = options;
	if(!contract?.taskExports?.length && !contract?.asyncIterators?.length) throw new TypeError("Expected a selected task or iterator");
	const ir=threadedHostSource(contract);
	if(contract.nativeEffects?.length || options.phpWasm && ir)
		throw new TypeError("Threaded Wasm task components require in-memory effects and a matching host");
	const env = {...environment, EMSDK: sdk, EM_CONFIG: join(sdk,".emscripten"), LANG: "C.UTF-8", LC_ALL: "C.UTF-8"};
	for(const key of ["CPATH","C_INCLUDE_PATH","CPLUS_INCLUDE_PATH","OBJC_INCLUDE_PATH","COMPILER_PATH","GCC_EXEC_PREFIX","LIBRARY_PATH","CFLAGS","CPPFLAGS","LDFLAGS","EMCC_CFLAGS","CCC_OVERRIDE_OPTIONS","DEPENDENCIES_OUTPUT","SUNPRO_DEPENDENCIES_OUTPUT"]) delete env[key];
	const run = (command,args,cwd=app,vars=env) => processBuildRunner.capture({command,args,cwd,env: vars,signal});
	const lean = join(leanPrefix,"bin/lean"), emcc = join(sdk,"upstream/emscripten/emcc");
	const kit=options.taskInputs;
	const stamp = kit ? kit.manifest.stamp : (await readFile(join(target,"source/.lean-wasm-patched"),"utf8")).trim();
	if(stamp !== taskStamp
		|| (await run(lean,["--githash"])).stdout.trim() !== pins.leanCommit
		|| (!kit && !/^MULTI_THREAD:BOOL=ON$/mu.test(await readFile(join(target,"cmake/CMakeCache.txt"),"utf8"))))
		throw new Error("Expected matching pinned Lean compiler and threaded Wasm runtime");
	const compiler = await identifyJavaScriptWasmCompiler({sdkRoot: sdk, run});
	if(kit && canonicalJson(compiler)!==canonicalJson(kit.manifest.compiler)) throw new Error("Installed Emscripten differs from the pthread SDK producer");
	const built = await compileHostSources({...options, ir, environment: env, target: options.phpWasm ? "php-wasm" : "npm", run});
	const {api,evidence,entries} = built;
	const assets = {"task-notification.h": await sourceAsset("javascript/wasm-task-watch.h")
		, "wasm-task-notification.h": await sourceAsset("javascript/task-notification.h")
		, "task-delivery.h": await sourceAsset("c/task-delivery.h")
		, "task-integers.h": await sourceAsset("c/task-integers.h")
		, "task-owner-policy.h": owner
		, "lean_bridge_native_runtime.h": generateOwnedWasmBroker().header};
	const headers = {}, include = join(app,"include/lean");
	const resources=api.types.filter(t => t.kind==="resource" && !t.host), wasmCallbacks=api.types.some(t => t.kind==="callback");
	const dummy="0".repeat(64), hostGen=id=>generateJavaScriptHostExterns(ir,id,{threaded: true});
	const provider=ir?hostGen(dummy):null;
	const wasmHostKinds=ir?ir.types.map((t,i)=>({name: t.name,id: t.id,hash: provider.model.kinds[i].key})):[];
	if(resources.length || ir) assets["task-resource-ledger.h"]=await wasmTaskLedgerHeader();
	if(wasmCallbacks)
	{
		assets["task-callback-port.h"]=await sourceAsset("c/task-callback-port.h");
		assets["task-callback-queue.h"]=await sourceAsset("native/task-callback-queue.h");
	}
	await mkdir(include,{recursive: true});
	for(const name of javascriptWasmTargetHeaders)
	{
		const bytes = kit ? kit.files.get(name) : await readFile(join(target,"cmake/include/lean",name));
		if(name === "version.h" && !bytes.toString().includes('#define LEAN_PLATFORM_TARGET "wasm32-unknown-emscripten"'))
			throw new Error("Expected threaded wasm32 headers, not host headers");
		headers[name] = sha256(bytes); await writeFile(join(include,name),bytes,{flag: "wx"});
	}
	const config = {name: "javascript-task-"+sha256(api.component.id), modules: evidence.selection.exportModules, entries, resources, wasmTasks: true, wasmCallbacks,wasmHostKinds,integerMode: "words"};
	const skeleton = generateCTaskExports({...config,componentIdentity: "0".repeat(64)});
	const wire = generateSyncWire(skeleton.prefix, entries, {tasks: true, wasmTasks: true,resources,wasmCallbacks,wasmHostKinds});
	const componentIdentity = sha256(canonicalJson({evidence
		, compiler
		, stamp
		, headers
		, skeleton
		, ...(provider?{hostProvider: {source: sha256(provider.source),renames: sha256(provider.renames)}}:{})
		, wire: sha256(wire.source)
		, control: sha256(generateTaskControl("lb_js_task_"+"0".repeat(64),wire))
		, assets: Object.fromEntries(Object.entries(assets).map(([k,v]) => [k,sha256(v)]))}));
	const abi = javaScriptTaskAbi(taskWorkerInterface(api,evidence),componentIdentity,ir), {controlSymbol} = abi, gen = generateCTaskExports({...config, componentIdentity});
	const leases = [...abi.leases??[],...abi.hostKinds??[]], nativeLeases = wire.leases ?? [];
	if(leases.length !== nativeLeases.length || leases.some((lease,i) =>
		["name","type","hash","tag"].some(k => lease[k] !== nativeLeases[i][k])))
		throw new Error("Generated Wasm resource layout differs from the public lease contract");
	if(abi.methods.length !== wire.methods.length || abi.methods.some((m,i) =>
		["name","declaration","effect","delivery","args","result","error","terminal","stepDeclaration","tagBytes"].some(k =>
			canonicalJson(m[k]) !== canonicalJson(wire.methods[i][k] ?? null))
			|| canonicalJson(m.callbacks ?? [])!==canonicalJson(wire.methods[i].callbacks ?? [])))
		throw new Error("Generated Wasm wire differs from the public task contract");
	const save = (name,bytes) => writeFile(join(app,name),bytes,{flag: "wx"});
	const objects=[...built.objects];
	if(ir)
	{
		threadedHostSource(contract,evidence);
		const iface=evidence.interfaces.findIndex(f=>f.module===contract.generatedHostModule),obj=objects[iface];
		if(!/^module[0-9]+\.c$/u.test(obj) || sha256(await readFile(join(app,obj)))!==evidence.interfaces[iface].cSha256)
			throw new Error("Compiled JavaScript host interface differs from its captured C");
		const imports=hostGen(componentIdentity);
		await save("host-renames.h",imports.renames);
		await save("host-imports.c",'#include "'+obj+'"\n'+imports.source);
		objects[iface]="host-imports.c";
	}
	for(const [file, bytes] of Object.entries(assets)) await save(file,bytes);
	await save(gen.entryModule+".lean", gen.entryLean);
	await run(lean,["-j1","-c","entry.c",gen.entryModule+".lean"],app,built.env);
	await save("checked.c",'#include "entry.c"\n'+gen.declarations+"\n");
	await save(gen.prefix+".h",gen.header); await save("adapter.c",gen.source); await save("wire.c",wire.source);
	await save("control.c",generateTaskControl(controlSymbol,wire));
	await run(emcc,["-O2"
		, "-g0"
		, "-fPIC"
		, "-pthread"
		, "-fvisibility=hidden"
		, "-fwasm-exceptions"
		, "-ffp-contract=off"
		, "-DLEAN_EMSCRIPTEN"
		, "-DLEAN_MULTI_THREAD"
		, "-I."
		, "-Iinclude"
		, "-ffile-prefix-map="+app+"=/build/js-task"
		, "-sSIDE_MODULE=2"
		, "-Wl,--no-entry"
		, "-Wl,--fatal-warnings"
		, "-Wl,--export="+controlSymbol
		, ...ir?["-include","host-renames.h"]:[]
		, ...objects
		, "checked.c"
		, "adapter.c"
		, "wire.c"
		, "control.c"
		, "-o"
		, "component.wasm"]);
	const binary = await readFile(join(app,"component.wasm")), module = await WebAssembly.compile(binary);
	const exported = WebAssembly.Module.exports(module);
	if(!exported.some(s => s.kind === "function" && s.name === controlSymbol)
		|| !WebAssembly.Module.imports(module).some(s => s.name === "lean_bridge_wasm_task_subscribe_v1"))
		throw new Error("Missing generated task control or shared runtime subscription");
	if(kit && canonicalJson(await identifyJavaScriptWasmCompiler({sdkRoot: sdk,run}))!==canonicalJson(compiler)) throw new Error("JavaScript compiler changed during task compilation");
	return {api, evidence, abi, methods: abi.methods, controlSymbol, componentIdentity, binary, integrity: sha256(binary)};
};
