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
 */
export const taskResourceLedger = async runtimeIdentity => {
	const asset = file => readFile(new URL("../backends/native/task-resource-ledger." + file, import.meta.url));
	const header = await asset("h"), source = await asset("c");
	const id = sha256(canonicalJson({ runtimeIdentity, header: sha256(header), source: sha256(source) }));
	return { header, source, id, name: `liblb_task_resources_${id}.so`, flag: `-DLB_LEASE_PREFIX=lb_task_resource_${id}_` };
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
		, "-lleanshared", "-llean_bridge_native"
		, "-Wl,-z,defs,-z,nodelete", "-Wl,--build-id=none"
		, `-Wl,-soname,${ledger.name}`
		, "-Wl,-rpath,$ORIGIN", "-o", ledger.name], app);
};
