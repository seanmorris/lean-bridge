/** @file Package a relocatable Component Model and native Wasmtime IO or task host. */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compileHostSources } from "../build/host-elaboration.mjs";
import { pinnedCompiledLean } from "../build/elaborated-component.mjs";
import { nativeArtifactPaths, readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { wasmtimeCapiIdentity } from "../build/native-wit-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { linkWitHost } from "../build/wit-sync-io-host.mjs";
import { compileWitSyncIO } from "../backends/wit/sync-io-model.mjs";
import { compileWitTaskResources } from "../backends/wit/task-model.mjs";
import { renderWitTaskHeader } from "../backends/wit/task-session.mjs";
import { renderWitHostHeader } from "../backends/wit/copied-host.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

const target = "wit-wasi";
const identity = bytes => ({bytes: bytes.length,sha256: sha256(bytes)});
const pc = (name,version,p,tasks) => `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib
Name: ${name}-wit
Description: Compiled Lean ${tasks ? "tasks" : "synchronous IO"} through Wasmtime
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p}_wasmtime -lwasmtime
Cflags: -I\${includedir}
`;

/**
 * Assemble from bytes verified against the compiled identities. No consumer
 * recompiles Lean, obtains a Wasmtime SDK, or supplies a native broker.
 *
 * @param options - Authenticated project inputs and private CLI release staging.
 */
export const buildWitHostPackage = async options => {
	const {projectContract,runtimeRoot,leanPrefix,workRoot,environment,signal} = options;
	const tasks=Boolean(projectContract.taskExports?.length);
	const profile=tasks ? "native-wit-task-v1" : "native-wit-io-v1";
	if((!tasks && projectContract.synchronousIO!==true) || options.ir || options.sources.some(s=>/^(?:LeanBridge(?:\.|$)|BridgeCAsync$)/u.test(s.module)))
		throw new Error("WIT IO and tasks require standalone Lean modules");
	const app = await mkdtemp(join(workRoot,".wit-io-"));
	const run = (command,args,cwd,env=environment)=>processBuildRunner.capture({command,args,cwd,env,signal});
	try
	{
		const {identity: runtimeIdentity,manifest} = await readVerifiedNativeRuntime(runtimeRoot);
		if(manifest.leanCommit!==pinnedCompiledLean) throw new Error("WIT IO requires the pinned native Lean runtime");
		const built = await compileHostSources({...options,app,run});
		const {api,evidence} = built, settings = {name: options.name,version: options.version};
		const host = await linkWitHost({app,built,run,settings,tasks
			, runtimeRoot,leanPrefix
			, wasmTools: environment.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools"
			, wasmtimeRoot: environment.LEAN_BRIDGE_WASMTIME_C_API});
		const {bindingIrSha256,componentIdentity} = host;
		const model = (tasks ? compileWitTaskResources : compileWitSyncIO)({api,evidence,bindingIrSha256,settings});
		if(host.runtimeIdentity!==runtimeIdentity) throw new Error("WIT IO runtime changed while compiling");
		const {name,version} = model, p = host.prefix, sdk = join(app,"wasmtime");
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
		if(!/^2\.\d+$/u.test(floor)) throw new Error("Invalid native WIT glibc floor");
		const files = new Map(), share = "share/lean-bridge", sdkFiles = {};
		for(const path of await nativeArtifactPaths(sdk))
		{
			const bytes = await readFile(join(sdk,path));
			sdkFiles[path] = identity(bytes);
			files.set(path==="LICENSE"?share+"/licenses/Wasmtime-LICENSE":path,bytes);
		}
		if(sha256(canonicalJson(sdkFiles))!==wasmtimeCapiIdentity.filesSha256) throw new Error("WIT SDK changed after compilation");
		const verifyElf = async (path,from,expected) => {
			const bytes = await readFile(from); validateNativeElf(bytes);
			if(sha256(bytes)!==expected) throw new Error("WIT library changed: "+path);
			const versions = (await run("readelf",["--version-info",from],app)).stdout;
			for(const m of versions.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1]>2 || (+m[1]===2 && (+m[2]>+floor.slice(2) || (+m[2]===+floor.slice(2) && +m[3]>0)))) throw new Error("WIT library exceeds glibc "+floor+": "+m[0]);
			files.set(path,bytes);
		};
		for(const dep of host.dependencies)
		{
			const file = "lib/"+dep.name, root = dep.name==="libwasmtime.so"?sdk:runtimeRoot;
			await verifyElf(file,join(root,file),dep.sha256);
		}
		await verifyElf("lib/"+host.library,join(app,host.library),host.librarySha256);
		const binary = await readFile(join(app,"component.wasm"));
		if(sha256(binary)!==host.componentSha256) throw new Error("WIT IO component changed after compilation");
		const header = tasks ? renderWitTaskHeader(model) : renderWitHostHeader({surface: model.layout,trackIOTraps: true});
		if(await readFile(join(app,host.header),"utf8")!==header) throw new Error("WIT IO host header differs from its API");
		files.set("include/"+host.header,header);
		files.set("wit/"+name+".wit",model.wit);
		files.set("component/"+name+".wasm",binary);
		files.set("component/"+name+".wat",model.wat);
		files.set("lib/pkgconfig/"+name+"-wit.pc",pc(name,version,p,tasks));
		files.set(share+"/binding-ir.json",canonicalJson(api));
		files.set(share+"/elaboration.json",canonicalJson(evidence));
		const review = projectContract.review;
		if(review)
		{
			if(review.sha256!==evidence.reviewedSourceSha256 || sha256(review.source)!==review.sha256 || review.semanticSha256!==bindingIrSha256)
				throw new Error("WIT IO review differs from compiled source evidence");
			files.set(share+"/reviewed.binding-ir.json",review.source);
		}
		files.set(share+"/runtime.json",canonicalJson(manifest));
		files.set(share+"/generated.lean",await readFile(join(app,"BridgeCAsync.lean")));
		files.set(share+"/licenses/LeanBridge-LICENSE",await readFile(new URL("../../LICENSE",import.meta.url)));
		for(const f of ["LICENSE","LICENSES"]) files.set(share+"/licenses/Lean-"+f,await readFile(join(leanPrefix,f)));
		for(const [path,bytes] of Object.entries(projectContract.notices)) files.set(share+"/licenses/"+path,bytes);
		files.set("package-metadata.json",canonicalJson(projectContract.metadata ?? {}));
		files.set("README.md",`# ${name} ${version}

Extract the entire archive. Add lib/pkgconfig to PKG_CONFIG_PATH and compile with pkg-config --cflags --libs ${name}-wit. Include ${host.header}. The package supplies Wasmtime ${wasmtimeCapiIdentity.version}, the native Lean runtime, and the compiled component; consumers do not need Lean. Linux x86-64, glibc ${floor} or newer.

${tasks ? `Open a main-thread session with ${p}_wit_open. Use the typed start, poll, await, cancel and drop functions in ${host.header}. Poll returns a borrowed Linux readiness descriptor while pending; do not read or close it. Await blocks the calling thread. Cancellation stops delivery, not necessarily Lean computation. Copies of a task refer to the same owner. Drop once; close the session to release all remaining tasks. Task payloads are copied. Dispose returned strings with ${p}_wit_string_dispose. A failed session can still be closed. No Wasmtime value construction or Lean compiler is needed.` : `Open a session with ${p}_wasmtime_open, call a WIT export with ${p}_wasmtime_call and close with ${p}_wasmtime_close. Do not use a session concurrently or after fork. Delete each returned value or Wasmtime error with its Wasmtime destructor. Results remain yours after closing the session. On error, the output slot is unchanged.

These calls are synchronous. The outer result of a fallible export carries its declared Lean failure; returned Except values retain their own inner branches. A boundary error is not a Lean failure. Unexpected traps retire the shared process runtime; do not replay effectful calls. For your own store, register imports with ${p}_wasmtime_link and invoke exports with ${p}_wasmtime_call_instance. Destroy your store when discard_store is set. A raw call that bypasses this guard cannot execute the native effect.`}

${tasks && model.wire.methods.some(m=>m.error || m.terminal || Array.isArray(m.result)) ? "A factory that throws returns START_ERROR instead of a task. A declared worker error delivers FAILED once. Both branches of a returned Except deliver READY. Initialize outputs that can own strings to zero and call their generated dispose function before reuse.\n\n" : ""}The component requires this native host; it is not a standalone WASI command. Declared native capabilities: ${projectContract.nativeEffects.join(", ") || "none"}. The host executes effects with the process's OS permissions. See share/lean-bridge/binding-ir.json for per-export capabilities.
`);
		const records = [...files].map(([path,v])=>({path,bytes: Buffer.isBuffer(v)?v:Buffer.from(v),mode: 0o644}));
		const kind=tasks ? "lean-bridge-wit-task-package" : "lean-bridge-wit-io-package";
		const pkg = { schemaVersion: 1, kind, profile
			, ecosystem: target, name, version, component: api.component
			, componentIdentity,runtimeIdentity,bindingIrSha256
			, glibcMinimumVersion: floor
			, componentSha256: host.componentSha256, hostSha256: host.librarySha256
			, ...(review?{reviewedSourceSha256: review.sha256}: {})
			, wasmtime: wasmtimeCapiIdentity
			, nativeEffects: projectContract.nativeEffects
			, files: Object.fromEntries(records.map(f=>[f.path,identity(f.bytes)])) };
		records.push({path: "lean-bridge-package.json",bytes: Buffer.from(canonicalJson(pkg)),mode: 0o644});
		const root = name+"-"+version+"-wit-wasi", archive = root+".tar.gz";
		const packed = createDeterministicTarGzFromFiles({sourceDateEpoch: 1,files: records.map(f=>({...f,path: root+"/"+f.path}))});
		await writeFile(join(options.output,archive),packed,{flag: "wx"});
		const packages = [{target,ecosystem: target,name,version,profile,role: "component",runtimeIdentity,runtimeDelivery: "embedded",requires: [],artifacts: [{path: "archives/"+archive,...identity(packed)}]}];
		const receipt = await writePackageSetReceipt({root: workRoot
			, component: api.component
			, source: {treeSha256: projectContract.sourceTreeSha256}
			, profiles: [{id: profile,bindingIrSha256,runtimeIdentity}]
			, packages,signal});
		return {receipt,api,evidence,bindingIrSha256,runtimeIdentity};
	}
	finally
	{ await rm(app,{recursive: true,force: true}); }
};
