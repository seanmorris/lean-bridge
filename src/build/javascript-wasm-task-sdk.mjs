/** @file Link the threaded author kit from pinned Lean/Init libraries, without reading any application. */
import {lstat,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {generateOwnedWasmBroker} from "../backends/javascript/owned-wasm-broker.mjs";
import {readTaskInputs,taskInputsName,taskInputPaths,taskStamp,taskProfile} from "../release/javascript-wasm-task-inputs.mjs";
import {processBuildRunner} from "./process-runner.mjs";
import {wasmLeasePrefix,wasmTaskLedgerHeader,wasmTaskLedgerSource} from "./javascript-wasm-task-ledger.mjs";
import {identifyJavaScriptWasmCompiler,javascriptWasmTargetHeaders,javascriptWasmOwnedPins} from "./javascript-wasm-toolchain.mjs";

const backend=fileURLToPath(new URL("../backends/javascript/",import.meta.url));
const scalar=/^lean_(?:alloc_|apply_|array_|b(?:ig_|yte)|copy_|cstr_|dec_ref|decode_lossy|free_object|float|i(?:nc_|nt[0-9_])|internal_panic|mark_|mk_|na[t_]|notify_assert|obj_once|sarray_|st_|string_|task_|u(?:int|size)|uvector_|io_(?:as_task|cancel_core|check_canceled|error_to_string|get_task_state_core|map_task|promise_|wait)|thunk_|s?int_to_|uint_to_)/u;
const initValues=/^(?:initialize_Init(?:_|$)|l_(?:Nat|Int|Bool|U?Int(?:8|16|32|64)|USize|ISize|Float(?:32)?|String|Array|List|Option|Except|ByteArray|Char|BaseIO|Task|IO_Promise)_)/u;
const symbolNames = async (nm, archive, select) => {
	const {stdout} = await nm(archive);
	return stdout.split("\n").map(line => line.split(" ")).filter(([name,type]) => select(name,type)).map(([name]) => name);
};
const flags = ["-O2"
	, "-g0"
	, "-flto"
	, "-pthread"
	, "-fwasm-exceptions"
	, "-DLEAN_EMSCRIPTEN"
	, "-DLEAN_MULTI_THREAD"
	, "-sDEFAULT_TO_CXX=1"
	, "-sMODULARIZE=1"
	, "-sEXPORT_ES6=1"
	, "-sPTHREAD_POOL_SIZE=4"
	, "-sPTHREAD_POOL_SIZE_STRICT=2"
	, "-sENVIRONMENT=node,web,worker"
	, "-sINITIAL_MEMORY=67108864"
	, "-sMAIN_MODULE=2"
	, "-sEXPORTED_RUNTIME_METHODS=PThread,FS,HEAP8"
	, "-Wl,--fatal-warnings"
	, "-Wl,--no-entry"];

/**
 * Produce a relocatable, content-addressed link owner and compiler headers.
 * No user project, side module, method list or host application signature is an input.
 *
 * @param options - Pinned SDK, patched target tree, matching PIC Init archive and absent output.
 */
export const prepareTaskSdk=async options => {
	const {signal}=options, sdk=resolve(options.emsdkRoot), target=resolve(options.leanRuntimeRoot), output=resolve(options.outputRoot);
	const core=join(target,"cmake"), init=resolve(options.initArchive ?? join(core,"lib/lean/libInit.a")), rt=join(core,"lib/lean/libleanrt.a"), uv=join(core,"libuv/src/libuv/libuv.a");
	const absent=async () => { if(await lstat(output).catch(e => {if(e.code!=="ENOENT") throw e;})) throw new Error("Threaded SDK output already exists"); };
	await absent();
	if((await readFile(join(target,"source/.lean-wasm-patched"),"utf8")).trim()!==taskStamp || !/^MULTI_THREAD:BOOL=ON$/mu.test(await readFile(join(core,"CMakeCache.txt"),"utf8")))
		throw new Error("Threaded SDK requires its pinned pthread target, not browser or host libraries");
	await mkdir(dirname(output),{recursive: true}); const work=await mkdtemp(join(dirname(output),".threaded-sdk-"));
	try
	{
		const environment={...options.environment,EMSDK: sdk,EM_CONFIG: join(sdk,".emscripten"),EMCC_CORES: "1",BINARYEN_CORES: "1",LANG: "C",LC_ALL: "C"};
		for(const k of ["CFLAGS","CPPFLAGS","CXXFLAGS","CPATH","C_INCLUDE_PATH","CPLUS_INCLUDE_PATH","LIBRARY_PATH","COMPILER_PATH","GCC_EXEC_PREFIX","LDFLAGS","EMCC_CFLAGS","CCC_OVERRIDE_OPTIONS"]) delete environment[k];
		const run=(command,args) => processBuildRunner.capture({command,args,cwd: work,env: environment,signal});
		const compiler=await identifyJavaScriptWasmCompiler({sdkRoot: sdk,run});
		const headers=Object.fromEntries(await Promise.all(javascriptWasmTargetHeaders.map(async n => [n,await readFile(join(core,"include/lean",n))])));
		const hashes=async () => ({core: sha256(await readFile(rt)),uv: sha256(await readFile(uv)),init: sha256(await readFile(init))});
		const libs=await hashes();
		if(options.initArchive)
		{
			const receipt=JSON.parse(await readFile(join(dirname(init),"inputs.json"),"utf8"));
			const expected={stamp: taskStamp,headers: Object.fromEntries(Object.entries(headers).map(([n,b]) => [n,sha256(b)])),archiveSha256: libs.init};
			if(receipt.commit!==javascriptWasmOwnedPins.leanCommit || canonicalJson(receipt.identity)!==canonicalJson(expected)) throw new Error("Init input differs from its pinned archive receipt");
		}
		const broker=generateOwnedWasmBroker(), main=await readFile(join(backend,"threaded-task-runtime.c")), notify=await readFile(join(backend,"task-notification.c")), header=await readFile(join(backend,"task-notification.h"));
		const hostIdentity=await readFile(join(backend,"threaded-host-identity.c"));
		for(const [n,b] of [["owner.c",main],["notify.c",notify],["task-notification.h",header],["host-identity.c",hostIdentity],["broker.c",broker.source],["lean_bridge_native_runtime.h",broker.header]])
			await writeFile(join(work,n),b,{flag: "wx"});
		const symbolTool=join(sdk,"upstream/bin/llvm-nm");
		const leaseHeader=await wasmTaskLedgerHeader(), leaseSource=await wasmTaskLedgerSource();
		await writeFile(join(work,"task-resource-ledger.h"),leaseHeader,{flag: "wx"});
		await writeFile(join(work,"task-resource-ledger.c"),leaseSource,{flag: "wx"});
		const nm=archive => run(symbolTool,["-g","--defined-only","--format=posix",archive]);
		const names=await symbolNames(nm,rt,(name,type) => type==="T" && scalar.test(name));
		// Export value operations and initializers from the pinned archive, not
		// operating-system functions (the Wasm libuv lacks those backends).
		// Init also implements public C ABI externs such as lean_io_error_to_string.
		const valueNames=await symbolNames(nm,init,(n,t) => ["T","D"].includes(t) && (scalar.test(n) || initValues.test(n)) && !n.includes("___at"));
		const roots=[...new Set([...names,...valueNames,...broker.exports,...broker.supportExports,"lean_bridge_wasm_task_subscribe_v1","emscripten_is_main_runtime_thread","emscripten_builtin_memalign","realloc","memmove","memcmp"])].sort();
		for(const op of ["create","borrow","release"]) roots.push(wasmLeasePrefix+op);
		roots.push("lean_bridge_wasm_task_ready_v1","lean_register_external_class","pthread_mutex_init","pthread_mutex_destroy","pthread_mutex_lock","pthread_mutex_unlock","pthread_once");
		roots.push("lean_bridge_wasm_callback_acquire_v1","lean_bridge_wasm_callback_release_v1");
		for(const op of ["wrap","token","admit","collect","retire"]) roots.push("lb_jst_"+op+"_v1");
		roots.sort();
		await writeFile(join(work,"roots.json"),JSON.stringify(roots.map(name => "_"+name)),{flag: "wx"});
		await run(join(sdk,"upstream/emscripten/emcc"),[...flags
			, "-I."
			, "-I"
			, join(core,"include")
			, "-ffile-prefix-map="+core+"=/lean-target"
			, "owner.c"
			, "notify.c"
			, "host-identity.c"
			, "broker.c"
			, "task-resource-ledger.c"
			, rt,uv,init
			, "-sEXPORTED_FUNCTIONS=@roots.json"
			, "-o","task.mjs"]);
		if(canonicalJson(libs)!==canonicalJson(await hashes()) || canonicalJson(compiler)!==canonicalJson(await identifyJavaScriptWasmCompiler({sdkRoot: sdk,run}))) throw new Error("Task SDK inputs changed during the link");
		const dir=join(work,"output"); await mkdir(dir);
		const files=new Map(Object.entries(headers)); files.set("LICENSE.lean",await readFile(join(target,"source/LICENSE")));
		for(const name of ["task.mjs","task.wasm"]) files.set(name,await readFile(join(work,name)));
		const recipe=sha256(canonicalJson({flags
			, roots
			, leaseHeader: sha256(leaseHeader)
			, leaseSource: sha256(leaseSource)
			, owner: sha256(main)
			, hostIdentity: sha256(hostIdentity)
			, notification: sha256(notify)
			, header: sha256(header)
			, broker: sha256(broker.source)
			, bridgeHeader: sha256(broker.header)
			, symbolTool: sha256(await readFile(symbolTool))
			, builder: sha256(await readFile(new URL(import.meta.url)))}));
		const manifest={schemaVersion: 1
			, profile: taskProfile
			, stamp: taskStamp
			, compiler
			, sources: {...libs,recipe}
			, files: Object.fromEntries(taskInputPaths.map(n => [n,{bytes: files.get(n).length,sha256: sha256(files.get(n))}]))};
		const bytes=Buffer.from(canonicalJson(manifest)), identity=sha256(bytes);
		files.set(taskInputsName,bytes); files.set(taskInputsName+".sha256",identity+"  "+taskInputsName+"\n");
		for(const [n,b] of files) await writeFile(join(dir,n),b,{flag: "wx"});
		await readTaskInputs(dir,{signal,expectedIdentity: identity}); signal?.throwIfAborted(); await absent(); await rename(dir,output);
		return {output,identity};
	} finally
	{ await rm(work,{recursive: true,force: true}); }
};
