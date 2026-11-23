/**
 * Bind JVM operations to one native owner; task readiness waits stay off that owner.
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
 * @param wire - Compiler-derived copied methods and optional task or pull protocols.
 * @param p - Native component symbol prefix.
 * @param reactor - Private Linux readiness operations; included only in task components.
 */
export const jvmIOEntry = (wire, p, reactor) => {
	if(Boolean(wire.wait) !== Boolean(reactor) || wire.leases || !wire.methods.length || wire.methods.some(m => m.callbacks?.length))
		throw new TypeError("The JVM IO and task profiles require copied values");
	const invoke = p + "_jvm_invoke", retire = p + "_jvm_retire";
	const source = `#include "${p}.h"
#include "io-owner.h"
#include "lean_bridge_native_runtime.h"
${wire.methods.filter(m => !m.delivery).map(m => "extern int " + m.symbol + "(const uint64_t *, uint64_t *, uint8_t *);").join("\n")}
typedef struct { int op, status; const uint64_t *args; uint64_t *out; uint8_t *tags; } lb_jvm_request;
static void invoke_on_owner(void *context) {
    lb_jvm_request *r = context;
    switch (r->op) {
${wire.methods.flatMap((m, i) => m.delivery ? [] : [`        case ${i}: r->status = ${m.symbol}(r->args, r->out, r->tags); break;`]).join("\n")}
        default: break;
    }
}
int ${invoke}(int op, const uint64_t *args, uint64_t *out, uint8_t *tags) {
    lb_jvm_request r = {op, ${p}_INVALID, args, out, tags};
    return LB_JVM_OWNER(call)(invoke_on_owner, &r) ? r.status : ${p}_UNAVAILABLE;
}
void ${retire}(void) { lean_bridge_native_runtime_retire(); }
`;
	if(!wire.wait) return { invoke, retire, source };
	const task = p + "_jvm_task", watch = p + "_jvm_watch";
	const ops = [["start", "const uint64_t *, uint64_t *, uint64_t *, uint8_t *", "r->args,r->h,r->out,r->tags"]
		, ["poll", "uint64_t *, int *", "r->h,r->fd"]
		, ["take", "uint64_t *, uint64_t *, uint8_t *", "r->h,r->out,r->tags"]
		, ["close", "uint64_t *", "r->h"], ["pull", "uint64_t *", "r->h"]];
	const declarations = [], cases = [];
	for(const [i, m] of wire.methods.entries()) if(m.delivery)
	{
		const wanted = ["start", "poll", "take", "close", ...m.delivery === "async-iterator" ? ["pull"] : []];
		if(!["task", "async-iterator"].includes(m.delivery) || Object.keys(m.names ?? {}).length !== wanted.length
			|| wanted.some(k => m.names[k] !== m.symbol + "_" + k)) throw new TypeError("Unverified JVM task operations: " + m.name);
		const row = [];
		for(const [j, [key, signature, args]] of ops.entries()) if(m.names[key])
		{
			declarations.push(`extern int ${m.names[key]}(${signature});`);
			row.push(`case ${j}: r->status = ${m.names[key]}(${args}); break;`);
		}
		cases.push(`case ${i}: switch(r->op){ ${row.join(" ")} } break;`);
	}
	if(!cases.length) throw new TypeError("The JVM task profile needs a compiler-checked task or cursor");
	const extra = `${declarations.join("\n")}
typedef struct {int method, op, status; const uint64_t *args; uint64_t *h, *out; uint8_t *tags; int *fd;} jvm_task_request;
static void task_on_owner(void *ptr) {
    jvm_task_request *r = ptr;
    switch(r->method) { ${cases.join("\n")} }
}
int ${task}(int method, int op, const uint64_t *args, uint64_t *h, uint64_t *out, uint8_t *tags, int *fd) {
    jvm_task_request r = {method, op, ${p}_INVALID, args, h, out, tags, fd};
    return LB_JVM_OWNER(call)(task_on_owner, &r) ? r.status : ${p}_UNAVAILABLE;
}
${reactor.toString().replace("__WATCH__", watch)}`;
	return { invoke, retire, task, watch, source: source + extra };
};
