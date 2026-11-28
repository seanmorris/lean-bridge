/**
 * Build the same optional, content-addressed lease library for native consumers.
 *
 * @file
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";

/**
 * Name the shared lease library from its exact runtime and source bytes.
 *
 * @param runtimeIdentity - Digest of the exact Lean runtime manifest.
 * @param owner - Optional verified JVM owner for this runtime; all other hosts use the process main thread.
 */
export const taskResourceLedger = async (runtimeIdentity, owner = null) => {
	const asset = file => readFile(new URL("../backends/native/task-resource-ledger." + file, import.meta.url));
	const header = await asset("h");
	let source = await asset("c");
	if(owner)
	{
		if(!/^[a-f0-9]{64}$/u.test(runtimeIdentity) || !/^[a-f0-9]{64}$/u.test(owner.id) || owner.name !== "liblb_jvm_owner_" + runtimeIdentity + ".so"
			|| owner.flag !== "-DLB_JVM_OWNER_PREFIX=lb_jvm_owner_" + owner.id + "_") throw new TypeError("Invalid JVM resource owner");
		const guard = "getpid() == (pid_t)syscall(SYS_gettid)", text = source.toString();
		if(text.split(guard).length !== 2) throw new Error("Expected exactly one native ledger owner guard");
		source = Buffer.from('#include "io-owner.h"\n' + text.replace(guard, "LB_JVM_OWNER(current)()")
			.replace("the process main thread", "the shared JVM owner thread"));
	}
	const id = sha256(canonicalJson({ runtimeIdentity, header: sha256(header), source: sha256(source), ...owner ? { owner: owner.id } : {} }));
	return { header, source, id, name: `liblb_task_resources_${id}.so`, flag: `-DLB_LEASE_PREFIX=lb_task_resource_${id}_`, ...owner ? { owner } : {} };
};

/**
 * Write the private header and library into an isolated component build directory.
 *
 * @param options - Ledger inputs, staging directory, verified runtime and compiler runner.
 */
export const compileTaskResourceLedger = async options => {
	const { ledger, app, runtimeRoot, cc, run } = options;
	await writeFile(join(app, "task-resource-ledger.h"), ledger.header, { flag: "wx" });
	await writeFile(join(app, "ledger.c"), ledger.source, { flag: "wx" });
	await run(cc, ["-std=gnu11", "-O1", "-g0", "-shared", "-fPIC", ledger.flag
		, "-I", join(runtimeRoot, "include")
		, `-ffile-prefix-map=${runtimeRoot}=/build/lean-bridge/runtime`
		, `-ffile-prefix-map=${app}=/build/lean-bridge/component`
		, "ledger.c", "-L", join(runtimeRoot, "lib")
		, ...ledger.owner ? [ledger.owner.flag, "-L.", "-l:" + ledger.owner.name] : []
		, "-lleanshared", "-llean_bridge_native"
		, "-Wl,-z,defs,-z,nodelete", "-Wl,--build-id=none"
		, `-Wl,-soname,${ledger.name}`
		, "-Wl,-rpath,$ORIGIN", "-o", ledger.name], app);
};
