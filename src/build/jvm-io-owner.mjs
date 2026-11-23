/**
 * Bind the synchronous JVM entry points to one process-wide native owner.
 *
 * @file
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";

const asset = path => readFile(new URL("../backends/" + path, import.meta.url));

/**
 * Inline the selected thread guard. Non-JVM consumers retain their original header bytes.
 *
 * @param jvm - Select the private, content-addressed JVM owner instead of the process main thread.
 */
export const nativeDeliveryHeader = async jvm => {
	const line = '#include "task-owner-policy.h"\n';
	const header = (await asset("c/task-delivery.h")).toString();
	if(header.split(line).length !== 2) throw new Error("Expected one native task owner policy");
	const owner = jvm ? '#include "io-owner.h"\nstatic int lb_context(void) { return LB_JVM_OWNER(current)() && lean_bridge_native_process_valid(); }\n'
		: (await asset("c/task-owner-policy.h")).toString();
	return Buffer.from(header.replace(line, () => owner));
};

/**
 * Build one worker SONAME per Lean runtime, with symbols bound to the exact implementation.
 *
 * @param options - Staging, verified Lean runtime, tool runner and selected C compiler.
 */
export const compileJvmIOOwner = async options => {
	const { app, runtimeRoot, runtimeIdentity, run, cc } = options;
	const header = await asset("jvm/io-owner.h"), source = await asset("jvm/io-owner.c");
	const id = sha256(canonicalJson({ runtimeIdentity, header: sha256(header), source: sha256(source) }));
	// One SONAME per runtime, one symbol namespace per implementation. This makes
	// the existing JVM loader reject a different worker instead of starting two.
	const name = "liblb_jvm_owner_" + runtimeIdentity + ".so", flag = "-DLB_JVM_OWNER_PREFIX=lb_jvm_owner_" + id + "_";
	for(const [p, b] of [["io-owner.h", header], ["io-owner.c", source]])
		await writeFile(join(app, p), b, { flag: "wx" });
	await run(cc, ["-std=gnu11", "-O1", "-g0", "-shared", "-fPIC", flag
		, "-fvisibility=hidden", "-pthread", "io-owner.c"
		, "-L", join(runtimeRoot, "lib")
		, "-lleanshared", "-Wl,-z,defs,-z,nodelete", "-Wl,--build-id=none"
		, "-Wl,-soname," + name, "-Wl,-rpath,$ORIGIN", "-o", name], app);
	return { id, name, flag };
};

/**
 * Only generated, enumerated calls cross the JVM downcall (never caller-provided functions).
 *
 * @param wire - Compiler-derived methods over the synchronous copy wire.
 * @param p - Native component symbol prefix.
 */
export const jvmIOEntry = (wire, p) => {
	if(wire.wait || wire.leases || !wire.methods.length) throw new TypeError("The JVM synchronous IO profile requires copied values");
	const invoke = p + "_jvm_invoke", retire = p + "_jvm_retire";
	const source = `#include "${p}.h"
#include "io-owner.h"
#include "lean_bridge_native_runtime.h"
${wire.methods.map(m => "extern int " + m.symbol + "(const uint64_t *, uint64_t *, uint8_t *);").join("\n")}
typedef struct { int op, status; const uint64_t *args; uint64_t *out; uint8_t *tags; } lb_jvm_request;
static void invoke_on_owner(void *context) {
    lb_jvm_request *r = context;
    switch (r->op) {
${wire.methods.map((m, i) => `        case ${i}: r->status = ${m.symbol}(r->args, r->out, r->tags); break;`).join("\n")}
        default: break;
    }
}
int ${invoke}(int op, const uint64_t *args, uint64_t *out, uint8_t *tags) {
    lb_jvm_request r = {op, ${p}_INVALID, args, out, tags};
    return LB_JVM_OWNER(call)(invoke_on_owner, &r) ? r.status : ${p}_UNAVAILABLE;
}
void ${retire}(void) { lean_bridge_native_runtime_retire(); }
`;
	return { invoke, retire, source };
};
