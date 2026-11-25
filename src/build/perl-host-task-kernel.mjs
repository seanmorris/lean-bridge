/** @file Compile Perl class-bearing tasks without linking the component against libperl. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nativeHostSelection } from "../analyze/host-export-model.mjs";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { perlHostWorkerAssets } from "../backends/perl/host-worker-scheduler.mjs";
import { perlWorkerKinds } from "../backends/perl/host-members.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeDeliveryHeader } from "./jvm-io-owner.mjs";
import { compileTaskResourceLedger, taskResourceLedger } from "./task-resource-ledger.mjs";

/**
 * Bind the private wire and its lease namespace to the original import.
 *
 * @param options - Verified compilation result, import IR, export modules, CPAN module and runtime.
 * @param options.checked - Freshly elaborated worker declarations and source evidence.
 * @param options.ir - Original Perl host import contract.
 * @param options.modules - Lean modules that supply the exports.
 * @param options.name - CPAN component module.
 * @param options.runtimeIdentity - Shared runtime digest for the resource ledger.
 */
export const perlHostTaskKernel = async ({checked,ir,modules,name,runtimeIdentity}) => {
	const {selection}=checked.evidence, expected=nativeHostSelection(ir,"perl");
	if(selection.perlTaskObjects!==true || selection.hostModule!==expected.hostModule
		|| canonicalJson(selection.resources)!==canonicalJson(expected.resources)
		|| canonicalJson(selection.members)!==canonicalJson(expected.members)) throw new TypeError("Missing authenticated Perl host-worker selection");
	const entries=checked.entries.filter(e=>e.delivery), kinds=perlWorkerKinds(ir);
	const coordinate=sha256(name), scope="lbpw_"+coordinate+"_";
	const generate=componentIdentity=>generateCTaskExports({name: "perl-"+coordinate
		, componentIdentity
		, modules
		, entries
		, integerMode: "words"
		, perlDelivery: true
		, perlHostKinds: kinds});
	const skeleton=generate("0".repeat(64)), wire=generateSyncWire(skeleton.prefix,entries,{tasks: true,perlHostKinds: kinds});
	wire.methods.forEach((m,i)=>{ if(entries[i].stepIO) m.stepIO=true; });
	const ledger=await taskResourceLedger(runtimeIdentity), headers={"task-delivery.h": await nativeDeliveryHeader(false)};
	for(const f of ["native/task-notification.h"
		, "native/task-callback-queue.h"
		, "c/task-callback-port.h"
		, "c/task-integers.h","perl/worker-ledger.h","perl/worker-ledger.c"])
		headers[f.split("/").at(-1)]=await readFile(new URL("../backends/"+f,import.meta.url));
	const assets=await perlHostWorkerAssets();
	const assetHashes=Object.fromEntries(Object.entries(assets).map(([n,b])=>[n,sha256(b)]));
	const fingerprint={skeleton
		, scope
		, assetHashes
		, wire: sha256(wire.source)
		, ledger: ledger.id
		, headers: Object.fromEntries(Object.entries(headers).map(([n,b])=>[n,sha256(b)]))};
	return {wire,ledger,generate,kinds,api: checked.api,assets,headers,fingerprint,scope,flag: "-DLBP_WORKER_PREFIX="+scope};
};

/**
 * Stage compiler-emitted Lean C and its checked signature in the same translation unit.
 *
 * @param o - Private staging root, authenticated kernel, component identity and build runner.
 */
export const stagePerlHostTasks = async o => {
	const {app,runtimeRoot,leanPrefix,cc,run,env,save,kernel,identity}=o;
	for(const [path,bytes] of Object.entries(kernel.headers)) await save(path,bytes);
	await compileTaskResourceLedger({ledger: kernel.ledger,app,runtimeRoot,cc,run});
	const ledgerHash=sha256(await readFile(join(app,kernel.ledger.name)));
	await save("worker-build-id.c",`__attribute__((used)) static const char ledger_origin[]="perl-worker-ledger:${kernel.ledger.id}:${ledgerHash}";\n`);
	const gen=kernel.generate(identity);
	await save("BridgeCAsync.lean",gen.entryLean);
	await run(join(leanPrefix,"bin/lean"),["-j1","-c","task-entry.c","BridgeCAsync.lean"],app,env);
	await save("checked-task-entry.c",'#include "task-entry.c"\n'+gen.declarations+"\n");
	await save(gen.prefix+".h",gen.header);
	await save("task-adapter.c",'#include "worker-ledger.h"\n'+gen.source);
	await save("host-task-wire.c",kernel.wire.source);
	return ["checked-task-entry.c","task-adapter.c","host-task-wire.c","worker-ledger.c","worker-build-id.c"];
};
