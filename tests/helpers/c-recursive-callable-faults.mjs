/**
 * Instrument fresh native graph and GMP adapters without changing archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { recursiveCallableCFaultConsumer } from "./c-recursive-callable-fixture.mjs";

/**
 * Fail graph and facade allocations separately, preserving output and ownership.
 *
 * @param output - Fresh release containing the exact compiled adapter sources.
 * @param working - Test-owned instrumentation workspace.
 * @param environment - Producer compiler selection.
 */
export const checkRecursiveCallableCFaults = async (output, working, environment) => {
	const adapter = join(output, "native/c-binding"), component = join(output, "native/component");
	const runtime = join(output, "native/runtime"), gmp = join(adapter, "gmp");
	const receipt = JSON.parse(await readFile(join(component, "native-component.json")));
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
		, "-g", "-fsanitize=address,undefined", "-fno-sanitize-recover=all"
		, "-fno-omit-frame-pointer", "-no-pie"];
	const objects = [], sources = [];
	const inputs = [["native", join(adapter, "src/native.c"), "LB_GRAPH"]
		, ["gmp", join(gmp, "src/structured_gmp.c"), "LB_GMP_GRAPH"]];
	const compileFlags = [...flags
		, "-I", join(adapter, "include"), "-I", join(adapter, "include/detail")
		, "-I", join(gmp, "include"), "-I", join(gmp, "include/detail")
		, "-I", join(gmp, "internal"), "-I", component
		, "-I", join(runtime, "include")];
	for(const [layer, path, macro] of inputs)
	{
		const source = await readFile(path, "utf8");
		const prelude = `#include <stddef.h>\nvoid *probe_${layer}_malloc(size_t);\nvoid probe_${layer}_free(void *);\n#define ${macro}_MALLOC probe_${layer}_malloc\n#define ${macro}_FREE probe_${layer}_free\n`;
		const instrumented = prelude + source;
		sources.push({ layer, sourceSha256: sha256(source), instrumentedSha256: sha256(instrumented) });
		await saveLakeFile(working, `${layer}.c`, instrumented);
		await runCopied(environment.CC ?? "cc", [...compileFlags
			, "-c", `${layer}.c`, "-o", `${layer}.o`], working, environment);
		objects.push(`${layer}.o`);
	}
	const source = recursiveCallableCFaultConsumer(), executable = join(working, "consumer");
	await saveLakeFile(working, "consumer.c", source);
	const libraries = ["-L", component, "-L", join(runtime, "lib")
		, "-L", join(gmp, "lib")
		, "-l:libgmp.so.10", `-l:${receipt.library}`, "-llean_bridge_native"
		, "-lleanshared"
		, `-Wl,-rpath,${component}`, `-Wl,-rpath,${join(runtime, "lib")}`
		, `-Wl,-rpath,${join(gmp, "lib")}`];
	const link = (name, selected) => runCopied(environment.CC ?? "cc", [...flags
		, "-I", join(gmp, "include"), "consumer.c", ...selected, ...libraries
		, "-o", name], working, environment);
	await link(executable, objects);
	const sanitized = { ...environment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
		, LSAN_OPTIONS: "exitcode=0", UBSAN_OPTIONS: "halt_on_error=1" };
	const startup = await runCopied(executable, ["--startup-only"], working, sanitized);
	const executed = await runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "recursive-c-faults", executable], working, sanitized);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.equal(normalize(executed.stderr), normalize(startup.stderr), "Recursive C fault injection changed the startup leak report");
	assert.doesNotMatch(executed.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const result = JSON.parse(executed.stdout);
	assert.equal(result.shapes, 9); assert.equal(result.aliases, 2); assert.ok(result.checks > 10_000);
	assert.equal(result.optionCases, 7); assert.equal(result.nestedResultCases, 7);
	assert.equal(result.resultCases, 15);
	assert.equal(result.edgeRejections, 52); assert.equal(result.acceptedDepths, 64);
	assert.equal(result.wrongThreads, 17); assert.equal(result.wrongProcesses, 1);
	assert.equal(result.activeDisposals, 2);
	assert.deepEqual(result.faults.map(row => row.shape), ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive", "nested-alias", "nested-plain"]);
	for(const row of result.faults)
	{
		assert.equal(row.nativeCases, 60); assert.equal(row.gmpCases, 60);
		assert.ok(row.nativeFailures >= 0 && row.gmpFailures > 0);
	}
	const facade = await readFile(join(working, "gmp.c"), "utf8"), rejectedMutations = [];
	for(const [name, omitted] of [["argument-arena", "lb_gg_release(argument0.head, &value0);"]
		, ["reply-owner", "LB_GMP_GRAPH_FREE(owner);"]]) {
		assert.ok(facade.includes(omitted));
		const mutant = facade.replaceAll(omitted, "/* deliberately omitted cleanup */");
		await saveLakeFile(working, `${name}.c`, mutant);
		await runCopied(environment.CC ?? "cc", [...compileFlags
			, "-c", `${name}.c`, "-o", `${name}.o`], working, environment);
		const command = join(working, name);
		await link(command, ["native.o", `${name}.o`]);
		await assert.rejects(runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', name, command], working, sanitized), error => {
			assert.equal(error.code, "build-command-failed");
			assert.match(error.details?.stderr ?? "", /live\[0\] == before_live\[0\] && live\[1\] == before_live\[1\]/u);
			return true;
		});
		rejectedMutations.push({ name, sourceSha256: sha256(mutant) });
		}
	return { result, sources, consumerSha256: sha256(source)
		, sanitizers: ["address", "leak", "undefined"]
		, trackedAllocationsRestoredAfterEveryCheckpoint: true
		, trackedLiveAllocationsAtExit: 0, rejectedMutations
		, startupLeakBaselineUnchanged: true
		, startupLeakReport: normalize(startup.stderr).replaceAll(output, "<release>")
		, executableSha256: sha256(await readFile(executable)) };
};
