/** @file Link the verified JVM task wire and JNI class registry on their shared native owner. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { jvmWorkerKinds } from "../backends/jvm/host-members.mjs";
import { sha256 } from "../capsule/node.mjs";
import { jvmIOEntry, nativeDeliveryHeader } from "./jvm-io-owner.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "./task-resource-ledger.mjs";

const asset = path => readFile(new URL("../backends/"+path,import.meta.url));
/**
 * Derive private entry points from the compiled classes and verified JVM owner.
 *
 * @param o - Authenticated runtime, owner, source and Maven coordinates.
 */
export const jvmHostTaskKernel = async o => {
	const { checked, ir, modules, name, runtimeIdentity, owner } = o;
	if(checked.evidence.selection.jvmTaskObjects !== true || checked.evidence.selection.hostModule !== "LeanBridge.Host.Jvm")
		throw new TypeError("Missing JVM host-worker compiler evidence");
	const entries = checked.entries.filter(e => e.delivery), jvmHostKinds = jvmWorkerKinds(ir);
	const taskName = "jvm-" + sha256(name);
	const generate = componentIdentity => generateCTaskExports({ name: taskName
		, modules, entries, jvmHostKinds, jvmDelivery: true
		, integerMode: "words", componentIdentity });
	const skeleton = generate("0".repeat(64)), wire = generateSyncWire(skeleton.prefix, entries, { tasks: true, jvmHostKinds });
	wire.methods.forEach((m,i) => { if(entries[i].stepIO) m.stepIO=true; });
	const port = jvmIOEntry(wire,skeleton.prefix,await asset("jvm/task-reactor.c"));
	const headers = {"task-delivery.h": await nativeDeliveryHeader(true)};
	for(const path of ["c/task-integers.h", "native/task-notification.h"
		, "native/task-callback-queue.h", "c/task-callback-port.h"
		, "jvm/worker-control.h", "jvm/worker-ledger.h", "jvm/worker-ledger.c"])
		headers[path.split("/").at(-1)] = await asset(path);
	const ledger = await taskResourceLedger(runtimeIdentity,owner);
	const headerHashes = Object.fromEntries(Object.entries(headers).map(([n,b])=>[n,sha256(b)]));
	const fingerprint = { skeleton, ledger: ledger.id, port: sha256(port.source)
		, wire: sha256(wire.source), headers: headerHashes };
	return { generate, wire, port, headers, ledger, fingerprint };
};

/**
 * Compile the actual Lean entry and stage relocatable provider sources.
 *
 * @param o - Kernel and tools in a private publisher directory.
 */
export const stageJvmHostTasks = async o => {
	const { kernel, identity, app, save, run, cc, leanPrefix, runtimeRoot, env } = o;
	for(const [f,b] of Object.entries(kernel.headers)) await save(f,b);
	await compileTaskResourceLedger({ ledger: kernel.ledger, app, cc, runtimeRoot, run });
	const gen=kernel.generate(identity);
	await save("BridgeCAsync.lean",gen.entryLean);
	await run(join(leanPrefix,"bin/lean"),["-j1","-c","task-entry.c","BridgeCAsync.lean"],app,env);
	await save("checked-task-entry.c",'#include "task-entry.c"\n'+gen.declarations+"\n");
	await save(gen.prefix+".h",gen.header);
	await save("task-adapter.c",'#include "worker-ledger.h"\n'+gen.source);
	await save("task-wire.c",kernel.wire.source);
	// The provider is hidden by default. These four entries, and only these,
	// also serve JDK foreign-function downcalls (class payloads themselves use JNI).
	const exports = ["int "+kernel.port.invoke+"(int,const uint64_t *,uint64_t *,uint8_t *)"
		, "void "+kernel.port.retire+"(void)"
		, "int "+kernel.port.task+"(int,int,const uint64_t *,uint64_t *,uint64_t *,uint8_t *,int *)"
		, "int64_t "+kernel.port.watch+"(int,int,int,int64_t)"];
	await save("jvm-task-port.c","#include <stdint.h>\n"+exports.map(s=>'__attribute__((visibility("default"))) '+s+";").join("\n")+"\n"+kernel.port.source);
	return ["checked-task-entry.c","task-adapter.c","task-wire.c","jvm-task-port.c","worker-ledger.c"];
};
