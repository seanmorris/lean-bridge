/** @file Bind the shared nominal lease ledger to the Wasm heap's owner agent. */
import {readFile} from "node:fs/promises";

export const wasmLeasePrefix="lb_js_task_lease_v1_";
const native=name => readFile(new URL("../backends/native/task-resource-ledger."+name,import.meta.url),"utf8");

/** Components get a header; only the shared runtime contains the table. */
export const wasmTaskLedgerHeader=async () => "#define LB_LEASE_PREFIX "+wasmLeasePrefix+"\n"+await native("h");

/** Require the Emscripten owner, not a Linux process or thread ID. */
export const wasmTaskLedgerSource=async () => {
	const source=await native("c"), includes="#include <sys/syscall.h>\n#include <unistd.h>";
	const owner="getpid() == (pid_t)syscall(SYS_gettid)";
	if(source.split(includes).length!==2 || source.split(owner).length!==2) throw new Error("Unrecognized native lease ledger owner policy");
	return source.replace(includes,"#include <emscripten/threading.h>").replace(owner,"emscripten_is_main_runtime_thread()");
};
