/** @file Compile the owner-scoped CLR worker ABI beside the checked CLR member provider. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { dotnetWorkerKinds } from "../backends/dotnet/host-members.mjs";
import { sha256 } from "../capsule/node.mjs";
import { nativeDeliveryHeader } from "./jvm-io-owner.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "./task-resource-ledger.mjs";

/**
 * Generate both sides from the verified CLR import source and real compiler evidence.
 *
 * @param options - Reconciled entries, captured host imports and verified Lean runtime.
 */
export const dotnetHostTaskKernel = async options => {
	const {checked,ir,name,modules,runtimeIdentity}=options;
	const selection=checked.evidence.selection;
	if(selection.dotnetTaskObjects!==true || selection.hostModule!=="LeanBridge.Host.Dotnet") throw new TypeError("Missing CLR worker object evidence");
	const entries=checked.entries.filter(e=>e.delivery), dotnetHostKinds=dotnetWorkerKinds(ir);
	const generate=componentIdentity=>generateCTaskExports({name: "clr-"+sha256(name),modules,entries,dotnetDelivery: true,integerMode: "words",dotnetHostKinds,componentIdentity});
	const skeleton=generate("0".repeat(64)), wire=generateSyncWire(skeleton.prefix,entries,{tasks: true,dotnetHostKinds});
	wire.methods.forEach((m,i)=>{if(entries[i].stepIO) m.stepIO=true;});
	const ledger=await taskResourceLedger(runtimeIdentity), headers={"task-delivery.h": await nativeDeliveryHeader(false)};
	for(const f of ["native/task-notification.h","c/task-callback-port.h","native/task-callback-queue.h","dotnet/worker-owner.h","dotnet/worker-ledger.h","dotnet/worker-ledger.c"])
		headers[f.split("/").at(-1)]=await readFile(new URL("../backends/"+f,import.meta.url));
	const fingerprint={skeleton, wire: sha256(wire.source), ledger: ledger.id
		, headers: Object.fromEntries(Object.entries(headers).map(([n,b])=>[n,sha256(b)]))};
	return {generate,wire,ledger,headers,fingerprint};
};

/**
 * Stage the compiled Lean worker and content-addressed native ledger.
 *
 * @param options - Authenticated build directory, kernel, tools and environment.
 */
export const stageDotnetHostTasks = async options => {
	const {kernel,identity,app,save,run,cc,leanPrefix,runtimeRoot,env}=options;
	for(const [name,bytes] of Object.entries(kernel.headers)) await save(name,bytes);
	await compileTaskResourceLedger({ledger: kernel.ledger,app,cc,runtimeRoot,run});
	const gen=kernel.generate(identity);
	await save("BridgeCAsync.lean",gen.entryLean);
	await run(join(leanPrefix,"bin/lean"),["-j1","-c","task-entry.c","BridgeCAsync.lean"],app,env);
	await save("checked-task-entry.c",'#include "task-entry.c"\n'+gen.declarations+"\n");
	await save(gen.prefix+".h",gen.header);
	await save("task-adapter.c",'#include "worker-ledger.h"\n'+gen.source);
	await save("task-wire.c",'#pragma GCC visibility push(default)\n'+kernel.wire.source);
	return ["checked-task-entry.c","task-adapter.c","task-wire.c","worker-ledger.c"];
};
