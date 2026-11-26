/** @file Assemble an offline-installable task component and its exact pthread runtime. */
import {readFile,readdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {javaScriptTaskAbi} from "../abi/javascript-wasm-tasks.mjs";
import {taskHostOwnerExports} from "../abi/wasm-task-frame.mjs";
import {reconcileHostExports,taskWorkerInterface} from "../analyze/host-export-model.mjs";
import {hashBindingIr} from "../binding-ir/canonical.mjs";
import {heapResourceIdentities} from "../analyze/heap-resource-identity.mjs";
import {threadedHostSource} from "../build/host-elaboration.mjs";
import {npmPackageMetadata} from "../analyze/package-metadata.mjs";
import {assertExportConfigurationCapabilities} from "../analyze/export-configuration.mjs";
import {generateJavaScriptPackage} from "../backends/javascript/generate.mjs";
import {generateJavaScriptHostPackage} from "../backends/javascript/host-public-package.mjs";
import {componentNpmIdentity} from "./component-package-receipt.mjs";
import {tarGzipPackingIdentity} from "./deterministic-archive.mjs";
import {archiveSharedJavaScriptPackages,assertWasmSideImports} from "./owned-javascript-npm-package.mjs";
import {writePackageSetReceipt} from "./package-set-receipt.mjs";
import {assertPhpWasmTaskConfiguration,attachPhpTaskPackages,phpTaskCoordinates,phpWasmTaskProfile} from "./php-wasm-task-packages.mjs";

const index = `import createModule from "./internal/task.mjs";
import {createWasmTaskLoader} from "./internal/runtime/wasm-task-loader.mjs";
const engine=createWasmTaskLoader(createModule);
export const loadTaskComponent=engine.load, closeTaskRuntime=engine.close,
  taskRuntimeStats=engine.stats, waitTaskRuntimeIdle=engine.whenIdle;
`;
/**
 * Assemble the closed ESM graph used by both JavaScript and Zend worker releases.
 *
 * @param mainModule - Prepared Emscripten owner module.
 * @param mainWasm - Matching compiled runtime bytes.
 * @param profile - Verified worker ABI profile.
 */
export const assembleJavaScriptTaskRuntime = async (mainModule,mainWasm,profile) => {
	const files=new Map([["index.mjs",index]
		, ["internal/task.mjs",mainModule]
		, ["internal/task.wasm",mainWasm]
		, ["LICENSE",await readFile(new URL("../../LICENSE",import.meta.url))]]);
	const assets=["runtime/wasm-task-loader"
		, "runtime/wasm-task-leases"
		, "runtime/wasm-task-host-members"
		, "runtime/wasm-host-domain"
		, "runtime/wasm-host-wire"
		, "runtime/wasm-host-members"
		, "release/component-scalar-codec"
		, "runtime/wasm-task-bindings"
		, "runtime/wasm-task-functions"
		, "runtime/wasm-task-callbacks"
		, "runtime/wasm-task-frames"
		, "runtime/wasm-task-notifications"
		, "runtime/pending-operations"
		, "abi/wasm-task-frame"
		, "abi/javascript-wasm-tasks"
		, "abi/javascript-task-hosts"
		, "abi/wasm-host-factories"
		, "abi/host-member-names"
		, "backends/javascript/host-members"
		, "backends/php/host-members"
		, "backends/native/static-host-members"
		, "abi/component-scalars"
		, "release/wasm-word-codecs"
		, "binding-ir/canonical"
		, "binding-ir/contract"
		, "binding-ir/default-value"
		, "binding-ir/sha256"];
	for(const path of assets) files.set("internal/"+path+".mjs",await readFile(new URL("../"+path+".mjs",import.meta.url)));
	files.set("index.d.mts",`declare const kind: unique symbol;
export interface LeanTaskLease<Hash extends string> {
  readonly [kind]: Hash;
  readonly disposed: boolean;
  dispose(): boolean;
  retain(): this;
  same(other: LeanTaskLease<Hash>): boolean;
}
export declare function waitTaskRuntimeIdle(): Promise<void>;
export declare function closeTaskRuntime(): Promise<void>;
export declare function taskRuntimeStats(): {
  state?: "open" | "closing" | "closed" | "poisoned";
  frames?: number; allocations?: number; pending?: number; nativeOwners: number | null; notifications: number;
  hostPins?: number; hostErrors?: number;
};
`);
	const notices=new URL("../../notices/runtime/",import.meta.url);
	for(const name of (await readdir(notices)).sort()) files.set("notices/"+name,await readFile(new URL(name,notices)));
	const metadata={name: "@lean-bridge/runtime"
		, license: "MIT"
		, type: "module"
		, engines: {node: ">=22"}
		, exports: "./index.mjs"
		, description: "Shared pthread runtime for Lean Bridge task packages."
		, leanBridge: {profile,sharedRuntime: true}};
	const identity={schemaVersion: 1
		, metadata
		, packing: await tarGzipPackingIdentity()
		, files: [...files].map(([path,content]) => ({path,sha256: sha256(content)}))};
	const runtimeIdentity=sha256(canonicalJson(identity)), version="0.0.0-task1.r"+runtimeIdentity;
	files.set("runtime-identity.json",canonicalJson(identity));
	files.set("package.json",canonicalJson({...metadata,version,leanBridge: {...metadata.leanBridge,runtimeIdentity}}));
	return {files,version,runtimeIdentity};
};

/**
 * Reject unsupported author choices before selecting any toolchain.
 *
 * @param configuration - Checked source configuration.
 */
export const assertJavaScriptTaskConfiguration=configuration => {
	assertExportConfigurationCapabilities(configuration,{target: "npm"
		, fields: ["package","modules","exports","resources","nativeEffects","asyncIterators","taskExports","taskIOErrors","taskCallbackPolicies","hostImports"]
		, targetFields: ["name","version"]});
	if(configuration.nativeEffects?.length) throw new Error("Threaded JavaScript tasks support only in-memory effects");
};

/**
 * Package a live source-checked compilation, not a user-supplied ABI or method table.
 *
 * @param options - Verified project snapshot, compiler output, prepared owner runtime and empty staging directory.
 */
export const writeJavaScriptTaskPackages = async options => {
	const {root,compilation,configuration,projectContract,captured,mainModule,mainWasm,signal}=options;
	const php=options.phpWasm===true;
	signal?.throwIfAborted(); (php?assertPhpWasmTaskConfiguration:assertJavaScriptTaskConfiguration)(configuration);
	const {api,evidence,componentIdentity,binary,integrity}=compilation;
	const hosts=threadedHostSource(projectContract,evidence,php?"php":"javascript"),zend=Boolean(php && hosts);
	if(Boolean(hosts)!==Boolean(configuration.hostImports)) throw new Error("Task host import configuration mismatch");
	const worker=taskWorkerInterface(api,evidence),abi=javaScriptTaskAbi(worker,componentIdentity,hosts,zend),publicHash=hashBindingIr(api);
	if(api.types.some(t=>t.kind==="callback" && !Object.hasOwn(t.source.extensions,"lean-bridge.dev/closure-owner")) && (php ? !evidence.selection.phpTaskCallbacks : !evidence.selection.javascriptTaskCallbacks))
		throw new Error("Retained callback contract does not match the target host");
	if(evidence.configurationSha256!==sha256(canonicalJson(configuration)) || evidence.sourceTreeSha256!==captured.document.packages[0].source.sourceTreeSha256
		|| canonicalJson(evidence.selection.taskCallbackPolicies ?? [])!==canonicalJson(configuration.taskCallbackPolicies ?? [])
		|| evidence.selection.phpWasmCallbackBudgets!==(php && configuration.taskCallbackPolicies ? true : undefined)
		|| evidence.reviewedSourceSha256!==(projectContract.review?.sha256 ?? null)
		|| canonicalJson(evidence.lake)!==canonicalJson(projectContract.lake) || canonicalJson(evidence.selection.exports)!==canonicalJson(projectContract.exports)
		|| sha256(binary)!==integrity || canonicalJson(abi)!==canonicalJson(compilation.abi))
		throw new Error("Task package differs from checked Lean project");
	const resources=evidence.metadata.leanResources ?? [];
	if(canonicalJson(resources.map(r => r.declaration).sort())!==canonicalJson([...(configuration.resources ?? [])].sort()))
		throw new Error("Task resource selection differs from the compiler metadata");
	const owned=resources.length ? heapResourceIdentities({...evidence,resources}) : [];
	const reconstructed=reconcileHostExports({ir: hosts, owned
		, selection: evidence.selection
		, metadata: evidence.metadata
		, component: projectContract.component
		, review: projectContract.review});
	if(canonicalJson(reconstructed.api)!==canonicalJson(api)) throw new Error("Task package differs from observed Lean interfaces");
	const main=new WebAssembly.Module(mainWasm), side=new WebAssembly.Module(binary);
	const exportsOf=m => new Set(WebAssembly.Module.exports(m).map(e => e.kind+":"+e.name));
	const runtimeExports=exportsOf(main), sideExports=exportsOf(side);
	const required=["lb_js_task_load","lb_js_task_call","malloc","free","bridge_owned_runtime_identities"];
	if(hosts) required.push(...taskHostOwnerExports);
	for(const name of required)
		if(!runtimeExports.has("function:"+name) || !mainModule.includes(Buffer.from("_"+name)))
			throw new Error("Prepared owner lacks JS task entry: "+name);
	const controls=WebAssembly.Module.exports(side).filter(e => e.name.startsWith("lb_js_task_"));
	if(controls.length!==1 || controls[0].name!==abi.controlSymbol || controls[0].kind!=="function" || runtimeExports.has("function:"+abi.controlSymbol)
		|| !WebAssembly.Module.imports(side).some(e => e.module==="env" && e.name==="lean_bridge_wasm_task_subscribe_v1" && e.kind==="function"))
		throw new Error("Invalid separation of compiled component and task runtime");
	assertWasmSideImports({side,runtimeExports,sideExports,profile: "task"});
	const profile=abi.profile, runtime=await assembleJavaScriptTaskRuntime(mainModule,mainWasm,profile);
	const coordinate=php?phpTaskCoordinates(api,configuration).npm:componentNpmIdentity(api.component,configuration.targets?.npm);
	if(coordinate.name==="@lean-bridge/runtime") throw new TypeError("Component cannot replace its shared task runtime");
	const phpHostBase={"package.json": canonicalJson({type: "module",exports: {".": {types: "./index.d.ts",default: "./index.mjs"}},files: ["index.mjs","index.d.ts","internal","README.md"]})};
	const files=new Map(Object.entries(zend?phpHostBase:hosts?generateJavaScriptHostPackage(api,hosts,componentIdentity,{threaded: true}):generateJavaScriptPackage(worker,componentIdentity)));
	const pkg=JSON.parse(files.get("package.json")), metadata=configuration.package ?? {};
	files.set("package.json",canonicalJson({...pkg
		, ...coordinate
		, license: metadata.license ?? "UNLICENSED"
		, description: api.documentation.summary
		, ...npmPackageMetadata(metadata)
		, engines: {node: ">=22"}
		, files: [...pkg.files,"metadata","notices"]
		, dependencies: {"@lean-bridge/runtime": runtime.version}
		, leanBridge: {profile
			, component: api.component.id
			, sharedRuntime: true
			, bindingIrSha256: publicHash
			, componentIdentitySha256: componentIdentity
			, runtimeIdentity: runtime.runtimeIdentity}}));
	const descriptor={bindingIr: worker,bindingIrSha256: abi.bindingIrSha256,componentIdentity,integrity,...zend?{zendObjects: true}:{}};
	if(hosts)
	{descriptor.hostImports=hosts;files.set("metadata/host-imports.json",projectContract.hostImportsSource);}
	files.set("internal/runtime.mjs",`import {loadTaskComponent} from "@lean-bridge/runtime";
${php && !zend ? "const component" : "export const runtime"}=await loadTaskComponent({...${canonicalJson(descriptor).trimEnd()},sideModule:new URL("./component.wasm",import.meta.url)});${php && !zend ? "\nexport const runtime=Object.freeze({invoke:component.invokeWithSynchronousStart,resourceClass:component.resourceClass});" : ""}
`);
	files.set("internal/component.wasm",binary);
	files.set("metadata/compiler.json",canonicalJson(evidence)); files.set("metadata/binding-ir.json",canonicalJson(api));
	if(projectContract.review) files.set("metadata/review.binding-ir.json",projectContract.review.source);
	for(const [path,bytes] of captured.files) files.set("notices/"+path,bytes);
	files.set("notices/lean-bridge.txt",await readFile(new URL("../../LICENSE",import.meta.url)));
	const composer=php?await attachPhpTaskPackages({api,worker,componentIdentity,configuration,files,coordinate,root,runtimeIdentity: runtime.runtimeIdentity,hosts}):null;
	const outputProfile=php?phpWasmTaskProfile:profile;
	const delivery=archiveSharedJavaScriptPackages({runtime,files,coordinate,profile: outputProfile});
	const packages=delivery.packages;
	if(php)
	{
		for(const p of packages) p.target="php-wasm";
		const requires=packages.map(({ecosystem,name,version})=>({ecosystem,name,version}));
		packages.push({target: "php-wasm",ecosystem: "composer"
			, name: composer.name,version: composer.version
			, profile: outputProfile,role: "api"
			, runtimeIdentity: runtime.runtimeIdentity
			, runtimeDelivery: "dependency"
			, requires
			, artifacts: [composer.artifact]});
	}
	for(const [path,bytes] of [[delivery.componentName,delivery.componentArchive],[delivery.runtimeName,delivery.runtimeArchive]])
		await writeFile(join(root,path),bytes,{flag: "wx",signal});
	const receipt={component: api.component
		, source: {treeSha256: evidence.sourceTreeSha256}
		, profiles: [{id: outputProfile,bindingIrSha256: publicHash,runtimeIdentity: runtime.runtimeIdentity}]
		, packages};
	await writePackageSetReceipt({root,...receipt,signal});
	return receipt;
};
