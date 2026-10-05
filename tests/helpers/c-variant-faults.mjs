/**
 * Instrument facade allocations while retaining the compiled Lean implementation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Fail input/output facade conversions without changing GMP's process allocator.
 *
 * @param output - Fresh native C release.
 * @param working - Isolated probe directory.
 * @param environment - Producer compiler environment.
 */
export const checkCVariantFaults = async (output, working, environment) => {
	const adapter = join(output, "native/c-binding"), gmp = join(adapter, "gmp"), lib = join(working, "lib");
	const source = await readFile(join(gmp, "src/variants_gmp.c"), "utf8");
	const instrumented = "#include <stddef.h>\nvoid *probe_malloc(size_t);\nvoid *probe_calloc(size_t,size_t);\nvoid probe_free(void*);\n" + source.replace(/\b(malloc|calloc|free)\b/g, "probe_$1");
	const consumer = await readFile("tests/fixtures/variant-consumers/gmp-probe.c", "utf8");
	await saveLakeFile(working, "facade.c", instrumented); await saveLakeFile(working, "probe.c", consumer);
	await cp(join(output, "native/runtime/lib"), lib, { recursive: true });
	const component = JSON.parse(await readFile(join(output, "native/component/native-component.json")));
	await cp(join(output, "native/component", component.library), join(lib, component.library));
	await cp(join(adapter, "lib/libvariants.so"), join(lib, "libvariants.so"));
	await cp(join(gmp, "lib/libgmp.so.10"), join(lib, "libgmp.so.10"));
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-g", "-no-pie"];
	await runCopied("/usr/bin/cc", [...flags, "-I", join(adapter, "include"), "-I", join(gmp, "include"), "-c", "facade.c", "-o", "facade.o"], working, environment);
	const executable = join(working, "probe");
	await runCopied("/usr/bin/cc", [...flags, "-I", join(gmp, "include"), "probe.c", "facade.o", "-L", lib, "-Wl,-rpath,$ORIGIN/lib", "-lvariants", "-l:libgmp.so.10", "-o", executable], working, environment);
	const env = { ...copiedCleanEnvironment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", LSAN_OPTIONS: "exitcode=0", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" };
	const baseline = await runCopied(executable, ["--startup-only"], working, env), result = await runCopied(executable, [], working, env);
	const normalize = value => value.replace(/==\d+==/g, "==PID==").replace(/0x[0-9a-f]+/g, "ADDRESS");
	assert.equal(normalize(result.stderr), normalize(baseline.stderr), "GMP conversions changed the startup-only leak report");
	assert.doesNotMatch(result.stderr, /ERROR: AddressSanitizer|runtime error:/);
	const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/.exec(baseline.stderr);
	if(baseline.stderr)
	{ assert.ok(leak, baseline.stderr); assert.match(baseline.stderr, /__gmp_default_allocate/); }
	const match = /^gmp-variant-fault-ok:(\d+):(\d+):(\d+):(\d+)\n$/.exec(result.stdout); assert.ok(match, result.stdout);
	const [checks, allocationFailures, rejected, previousPayloadsReleased] = match.slice(1).map(Number);
	assert.ok(allocationFailures >= 100); assert.equal(rejected, 4); assert.equal(previousPayloadsReleased, 32);
	return { checks, allocationFailures, rejected, previousPayloadsReleased
		, realLeanExecution: true
		, sanitizers: ["address", "leak", "undefined"], facadeAllocatorOnly: true
		, startupLeakBaseline: { bytes: Number(leak?.[1] ?? 0), allocations: Number(leak?.[2] ?? 0), unchangedAfterConversions: true, report: normalize(baseline.stderr) }
		, adapterSha256: sha256(source), probeAdapterSha256: sha256(instrumented)
		, consumerSha256: sha256(consumer)
		, executableSha256: sha256(await readFile(executable)) };
};
