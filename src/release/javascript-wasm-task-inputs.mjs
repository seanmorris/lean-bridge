/** @file Read the immutable author-side pthread runtime and its matching compile headers as one unit. */
import {lstat,readdir} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {javascriptWasmOwnedPins as pins,javascriptWasmTargetHeaders,validJavaScriptWasmCompilerIdentity} from "../build/javascript-wasm-toolchain.mjs";
import {readReceiptBytes} from "./package-set-receipt.mjs";

export const taskProfile="javascript-wasm-threaded-task-v1";
export const threadedTaskPatch="3a660e7700f40784e59fcbca0d20993313bf18303c1f250108533b34ed2e52df";
export const taskStamp=pins.leanCommit+" "+threadedTaskPatch+" threaded-task";
export const taskInputsName="javascript-wasm-task-inputs.json";
export const taskInputPaths=["task.mjs","task.wasm","LICENSE.lean",...javascriptWasmTargetHeaders].sort();
const hash=v => typeof v==="string" && /^[a-f0-9]{64}$(?![\s\S])/u.test(v);
const exact=(o,keys) => o && typeof o==="object" && !Array.isArray(o) && canonicalJson(Object.keys(o).sort())===canonicalJson([...keys].sort());
const fail=message => { throw Object.assign(new Error(message),{code: "invalid-javascript-task-inputs"}); };

/**
 * Verify a closed flat bundle before using any bytes. Its digest identifies a
 * trusted author input; a local sidecar is not a registry/publisher signature.
 *
 * @param root - Extracted SDK input directory.
 * @param options - Optional abort signal and out-of-band manifest digest.
 */
export const readTaskInputs=async (root,options={}) => {
	const {signal,expectedIdentity}=options;
	if(!(await lstat(root)).isDirectory()) fail("Expected a regular pthread SDK directory");
	const expected=[...taskInputPaths,taskInputsName,taskInputsName+".sha256"].sort();
	const entries=await readdir(root,{withFileTypes: true});
	if(!entries.every(e => e.isFile()) || canonicalJson(entries.map(e => e.name).sort())!==canonicalJson(expected))
		fail("Missing, non-regular or extra pthread SDK file");
	const bytes=await readReceiptBytes(join(root,taskInputsName),signal,16384), manifest=JSON.parse(bytes);
	const identity=sha256(bytes);
	if((expectedIdentity!==undefined && expectedIdentity!==identity) || !(await readReceiptBytes(join(root,taskInputsName+".sha256"),signal,256)).equals(Buffer.from(identity+"  "+taskInputsName+"\n")))
		fail("Threaded SDK manifest digest mismatch");
	if(!bytes.equals(Buffer.from(canonicalJson(manifest))) || !exact(manifest,["schemaVersion","profile","stamp","compiler","sources","files"])
		|| manifest.schemaVersion!==1 || manifest.profile!==taskProfile || manifest.stamp!==taskStamp || !validJavaScriptWasmCompilerIdentity(manifest.compiler)
		|| !exact(manifest.sources,["core","uv","init","recipe"]) || !Object.values(manifest.sources).every(hash) || !exact(manifest.files,taskInputPaths))
		fail("Invalid threaded SDK manifest or compiler pins");
	const files=new Map();
	for(const name of taskInputPaths)
	{
		const item=manifest.files[name], limit=name==="task.wasm" ? 128<<20 : name==="task.mjs" ? 32<<20 : 4<<20;
		if(!exact(item,["bytes","sha256"]) || !Number.isSafeInteger(item.bytes) || item.bytes<0 || item.bytes>limit || !hash(item.sha256))
			fail("Invalid threaded SDK file identity: "+name);
		const data=await readReceiptBytes(join(root,name),signal,item.bytes);
		if(item.bytes!==data.length || sha256(data)!==item.sha256) fail("Threaded SDK file drift: "+name);
		files.set(name,data);
	}
	if(!files.get("version.h").includes(Buffer.from('#define LEAN_PLATFORM_TARGET "wasm32-unknown-emscripten"'))
		|| !files.get("version.h").includes(Buffer.from('#define LEAN_VERSION_STRING "4.32.2"'))) fail("Expected pinned wasm32 Lean headers");
	const exports=WebAssembly.Module.exports(new WebAssembly.Module(files.get("task.wasm")));
	for(const entry of ["malloc","free","bridge_owned_runtime_identities","lb_js_task_call","lb_js_task_load","lean_bridge_wasm_task_subscribe_v1"])
		if(!exports.some(s => s.name===entry && s.kind==="function")) fail("Threaded SDK lacks runtime entry: "+entry);
	files.set(taskInputsName,bytes); files.set(taskInputsName+".sha256",Buffer.from(identity+"  "+taskInputsName+"\n"));
	return {identity,manifest,files};
};
