/** @file Build the native word adapter used by the MRI owner, never by Ruby worker threads. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { rubyWorkerKinds } from "../backends/ruby/host-provider.mjs";
import { sha256 } from "../capsule/node.mjs";
import { nativeDeliveryHeader } from "./jvm-io-owner.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "./task-resource-ledger.mjs";

/**
 * Produce both sides from compiled entries and the original host contract.
 *
 * @param options - Actual compiled entries, captured author contract and runtime identity.
 */
export const rubyHostTaskKernel = async options => {
	const {checked, ir, runtimeIdentity, modules, name} = options;
	const sel = checked.evidence.selection;
	if(sel.rubyTaskObjects !== true || sel.hostModule !== "LeanBridge.Host.Ruby") throw new TypeError("Missing MRI worker object evidence");
	const entries = checked.entries.filter(e => e.delivery), rubyHostKinds = rubyWorkerKinds(ir);
	const generate = componentIdentity => generateCTaskExports({name: "ruby-" + sha256(name), componentIdentity, modules, entries, integerMode: "words", rubyDelivery: true, rubyHostKinds});
	const skeleton = generate("0".repeat(64)), wire = generateSyncWire(skeleton.prefix, entries, {tasks: true, rubyHostKinds});
	const ledger = await taskResourceLedger(runtimeIdentity), headers = {"task-delivery.h": await nativeDeliveryHeader(false)};
	for(const f of ["native/task-notification.h","c/task-callback-port.h","native/task-callback-queue.h","ruby/worker-host-leases.h","ruby/worker-ledger.h","ruby/worker-ledger.c"])
		headers[f.split("/").at(-1)] = await readFile(new URL("../backends/" + f, import.meta.url));
	const fingerprint = {skeleton, wire: sha256(wire.source), ledger: ledger.id
		, headers: Object.fromEntries(Object.entries(headers).map(([n,b]) => [n,sha256(b)]))};
	return {generate, wire, headers, fingerprint, ledger};
};

/**
 * Compile the Lean entry points and the matching private resource library.
 *
 * @param options - Authenticated build environment, owner adapter and staged component.
 */
export const stageRubyHostTasks = async options => {
	const {kernel, identity, save, run, app, cc, leanPrefix, runtimeRoot, env} = options;
	for(const [n,b] of Object.entries(kernel.headers)) await save(n,b);
	await compileTaskResourceLedger({ledger: kernel.ledger,app,cc,runtimeRoot,run});
	const gen = kernel.generate(identity);
	await save("BridgeCAsync.lean",gen.entryLean);
	await run(join(leanPrefix,"bin/lean"),["-j1","-c","task-entry.c","BridgeCAsync.lean"],app,env);
	await save("checked-task-entry.c",'#include "task-entry.c"\n' + gen.declarations + "\n");
	await save(gen.prefix + ".h",gen.header); await save("task-adapter.c",'#include "worker-ledger.h"\n'+gen.source);
	await save("host-task-wire.c",kernel.wire.source);
	return ["checked-task-entry.c","task-adapter.c","host-task-wire.c","worker-ledger.c"];
};
