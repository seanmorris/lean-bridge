/** @file Compile the private task and scoped object transport used by native word-ABI owners. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { sha256 } from "../capsule/node.mjs";
import { nativeDeliveryHeader } from "./jvm-io-owner.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "./task-resource-ledger.mjs";

/**
 * Generate a private task port and scoped object ledger for process-main-thread
 * word-ABI bindings. The producer must authenticate the owner and nominal keys.
 *
 * @param options - Checked entries, compiler-owned layout, component name and runtime.
 */
export const wordHostTaskKernel = async options => {
	const {name,modules,entries,runtimeIdentity,adapter,layout}=options;
	const generate=componentIdentity=>generateCTaskExports({name,modules,entries,...adapter,integerMode: "words",componentIdentity});
	const skeleton=generate("0".repeat(64)), wire=generateSyncWire(skeleton.prefix,entries,{tasks: true,...layout});
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
export const stageWordHostTasks = async options => {
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
