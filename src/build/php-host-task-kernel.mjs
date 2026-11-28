/** @file Private worker kernel paired with the native PHP member provider. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { phpHostMembers } from "../backends/php/host-members.mjs";
import { generatePhpIOPort } from "../backends/php/io-port.mjs";
import { sha256 } from "../capsule/node.mjs";
import { nativeDeliveryHeader } from "./jvm-io-owner.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "./task-resource-ledger.mjs";

const asset=path=>readFile(new URL("../backends/"+path,import.meta.url));
/**
 * Prepare a content-addressable codegen input; caller fingerprints it before linking.
 *
 * @param o - Actual checked implementation, PHP imports, runtime and modules.
 */
export const phpHostTaskKernel=async o=>{
	const {checked,ir,runtimeIdentity,modules,name}=o;
	if(checked.evidence.selection.phpNativeTaskObjects!==true) throw new TypeError("Missing native PHP task object evidence");
	const entries=checked.entries.filter(e=>e.delivery);
	const phpHostKinds=phpHostMembers(ir).kinds.map((k,i)=>({name: k.name,hash: k.key,id: ir.types[i].id}));
	const options={name: "php-"+sha256(name),modules,entries,integerMode: "words",phpDelivery: true,phpHostKinds};
	const generate=componentIdentity=>generateCTaskExports({...options,componentIdentity});
	const skeleton=generate("0".repeat(64)),wire=generateSyncWire(skeleton.prefix,entries,{tasks: true,phpHostKinds});
	const methods=wire.methods.map((m,i)=>({...m,error: entries[i].effect==="IO"?"string":m.error,terminal: entries[i].taskIO?"string":m.terminal??null,...entries[i].stepIO?{stepIO: true}:{}}));
	const port=generatePhpIOPort({prefix: skeleton.prefix,methods,wire,phpHostKinds});
	const ledger=await taskResourceLedger(runtimeIdentity),headers={"task-delivery.h": await nativeDeliveryHeader(false)};
	for(const f of ["native/task-notification.h","c/task-callback-port.h","native/task-callback-queue.h","php/host-task-leases.h"])
		headers[f.split("/").at(-1)]=await asset(f);
	const headerHashes=Object.fromEntries(Object.entries(headers).map(([n,b])=>[n,sha256(b)]));
	const fingerprint={skeleton
		, wire: sha256(wire.source)
		, port: sha256(port.source)
		, header: sha256(port.header)
		, ledger: ledger.id
		, headers: headerHashes};
	return {generate,methods,wire,port,ledger,headers,fingerprint};
};

/**
 * Stage native task and byte-buffer adapters alongside the checked member provider.
 *
 * @param o - Caller-owned fresh directory, authenticated source environment and SDK.
 */
export const stagePhpHostTasks=async o=>{
	const {kernel,identity,save,run,app,cc,leanPrefix,runtimeRoot,env}=o;
	const gen=kernel.generate(identity);
	for(const [name,bytes] of Object.entries(kernel.headers)) await save(name,bytes);
	await compileTaskResourceLedger({ledger: kernel.ledger,app,cc,runtimeRoot,run});
	await save("BridgeCAsync.lean",gen.entryLean);
	await run(join(leanPrefix,"bin/lean"),["-j1","-c","task-entry.c","BridgeCAsync.lean"],app,env);
	await save("checked-task-entry.c",'#include "task-entry.c"\n'+gen.declarations+"\n");
	await save(gen.prefix+".h",gen.header); await save("task-adapter.c",gen.source);
	// Only the private PHP byte port (and its readiness symbols) is exported.
	await save("host-wire.c",'#pragma GCC visibility push(default)\n'+kernel.wire.source);
	await save("php-io-port.h",kernel.port.header);
	await save("php-io.c",'#pragma GCC visibility push(default)\n'+kernel.port.source);
	return ["checked-task-entry.c","task-adapter.c","host-wire.c","php-io.c"];
};
