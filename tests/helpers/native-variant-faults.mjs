/**
 * Allocation and malformed-tag probes over the real generated native adapter.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Interpose only bridge allocations. Lean allocation and compiled code stay intact.
 *
 * @param output - Fresh native release.
 * @param working - Isolated probe directory.
 * @param environment - Explicit compiler selection.
 * @param options - Optional independent consumer for a source-authenticated wrapper.
 * @param options.consumerSource - C consumer bytes, otherwise the shared fixture.
 */
export const checkNativeVariantFaults = async (output, working, environment, { consumerSource } = {}) => {
	const binding = join(output, "native/c-binding"), component = join(output, "native/component"), runtime = join(output, "native/runtime");
	const receipt = JSON.parse(await readFile(join(component, "native-component.json")));
	const source = await readFile(join(binding, "src/native.c"), "utf8");
	const tagged = source.replace(/uint32_t kind = (lb_t\w+_tag\(value\));/g, "uint32_t kind = $1; if (probe_bad_tag) kind = UINT32_MAX;");
	assert.notEqual(source, tagged);
	const adapter = "#include <stddef.h>\nextern int probe_bad_tag;\nvoid *probe_malloc(size_t);\nvoid *probe_calloc(size_t,size_t);\nvoid *probe_realloc(void*,size_t);\nvoid probe_free(void*);\n" + tagged.replace(/\b(malloc|calloc|realloc|free)\b/g, "probe_$1");
	const consumer = consumerSource ?? await readFile("tests/fixtures/variant-consumers/native-probe.c", "utf8");
	await saveLakeFile(working, "adapter.c", adapter); await saveLakeFile(working, "probe.c", consumer);
	const executable = join(working, "probe");
	await runCopied("/usr/bin/cc", ["-std=c11"
		, "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
		, "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-g", "-no-pie"
		, "-I", join(binding, "include")
		, "-I", join(binding, "internal")
		, "-I", component, "-I", join(runtime, "include")
		, "adapter.c", "probe.c", join(binding, "src/variants.c")
		, "-L", component, "-L", join(runtime, "lib")
		, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
		, `-Wl,-rpath,${component}`
		, `-Wl,-rpath,${join(runtime, "lib")}`
		, "-o", executable], working, environment);
	const sanitizerEnvironment = { ...copiedCleanEnvironment
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
		, LSAN_OPTIONS: "exitcode=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" };
	const baseline = await runCopied(executable, ["--startup-only"], working, sanitizerEnvironment);
	const result = await runCopied(executable, [], working, sanitizerEnvironment);
	const leakReport = text => text.replace(/==\d+==/g, "==PID==").replace(/0x[0-9a-f]+/g, "ADDRESS");
	assert.equal(leakReport(result.stderr), leakReport(baseline.stderr), "Conversions changed the startup-only sanitizer report");
	assert.doesNotMatch(result.stderr, /ERROR: AddressSanitizer|runtime error:/);
	const startup = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/.exec(baseline.stderr);
	if(baseline.stderr)
	{ assert.ok(startup, baseline.stderr); assert.match(baseline.stderr, /__gmp_default_allocate/); }
	const match = /^variant-fault-ok:(\d+):(\d+):(\d+):(\d+)\n$/.exec(result.stdout);
	assert.ok(match, result.stdout);
	const [checks, allocationFailures, rejected, malformedNativeTags] = match.slice(1).map(Number);
	assert.ok(allocationFailures >= 100 && rejected >= 70 && malformedNativeTags === 1);
	return { checks, allocationFailures, rejected, malformedNativeTags
		, sanitizers: ["address", "leak", "undefined"]
		, startupLeakBaseline: { bytes: Number(startup?.[1] ?? 0), allocations: Number(startup?.[2] ?? 0), unchangedAfterConversions: true, report: leakReport(baseline.stderr) }
		, realLeanExecution: true, syntheticTagInjection: true
		, adapterSha256: sha256(source), probeAdapterSha256: sha256(adapter)
		, consumerSha256: sha256(consumer)
		, executableSha256: sha256(await readFile(executable)) };
};
