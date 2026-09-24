/**
 * Exercise both structured callback conversion layers with allocation failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { structuredCallableCFaultConsumer } from "./structured-callable-c-consumer.mjs";

/**
 * Instrument generated adapters, leaving the packaged binaries unchanged.
 *
 * @param output - Fresh C release directory.
 * @param working - Private fault-injection directory.
 * @param environment - Producer compiler and runtime selection.
 */
export const checkStructuredCallableFaults = async (output, working, environment) => {
	const adapter = join(output, "native/c-binding"), component = join(output, "native/component");
	const runtime = join(output, "native/runtime"), gmp = join(adapter, "gmp");
	const receipt = JSON.parse(await readFile(join(component, "native-component.json")));
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-g", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-no-pie"];
	const objects = [], sources = [];
	for(const [name, sourcePath, layer] of [
		["native", join(adapter, "src/native.c"), "native"]
		, ["structured", join(adapter, "src/structured.c"), "native"]
		, ["facade", join(gmp, "src/structured_gmp.c"), "gmp"]
	]) {
		const prelude = `#include <stddef.h>\nvoid *probe_${layer}_malloc(size_t);\nvoid *probe_${layer}_calloc(size_t, size_t);\nvoid *probe_${layer}_realloc(void *, size_t);\nvoid probe_${layer}_free(void *);\n`;
		const source = await readFile(sourcePath, "utf8");
		const instrumented = prelude + source.replace(/\b(malloc|calloc|realloc|free)\b/g, `probe_${layer}_$1`);
		sources.push({ name, layer, sourceSha256: sha256(source), instrumentedSha256: sha256(instrumented) });
		await saveLakeFile(working, `${name}.c`, instrumented);
		await runCopied(environment.CC ?? "cc", [...flags
			, "-I", join(adapter, "include"), "-I", join(adapter, "internal")
			, "-I", join(gmp, "include")
			, "-I", component, "-I", join(runtime, "include")
			, "-c", `${name}.c`, "-o", `${name}.o`], working, environment);
		objects.push(`${name}.o`);
	}
	const consumerSource = structuredCallableCFaultConsumer();
	await saveLakeFile(working, "consumer.c", consumerSource);
	const command = join(working, "consumer");
	await runCopied(environment.CC ?? "cc", [...flags
		, "-I", join(gmp, "include"), "consumer.c", ...objects
		, "-L", component, "-L", join(runtime, "lib"), "-L", join(gmp, "lib")
		, "-l:libgmp.so.10", `-l:${receipt.library}`
		, "-llean_bridge_native", "-lleanshared"
		, `-Wl,-rpath,${component}`, `-Wl,-rpath,${join(runtime, "lib")}`
		, `-Wl,-rpath,${join(gmp, "lib")}`
		, "-o", command], working, environment);
	const sanitizerEnvironment = { ...environment
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
		, LSAN_OPTIONS: "exitcode=0"
		, UBSAN_OPTIONS: "halt_on_error=1" };
	const baseline = await runCopied(command, ["--startup-only"], working, sanitizerEnvironment);
	const result = await runCopied(command, [], working, sanitizerEnvironment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.equal(normalize(result.stderr), normalize(baseline.stderr), "Structured callbacks changed the startup-only leak report");
	assert.doesNotMatch(result.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/u.exec(baseline.stderr);
	if(baseline.stderr)
	{ assert.ok(leak, baseline.stderr); assert.match(baseline.stderr, /__gmp_default_allocate/u); }
	assert.match(result.stdout, /^structured-c:\d+\n$/u);
	const checks = Number(result.stdout.trim().split(":")[1]); assert.ok(checks > 10_000);
	return { checks, layers: ["native", "gmp"]
		, sanitizers: ["address", "leak", "undefined"]
		, startupLeakBaseline: { bytes: Number(leak?.[1] ?? 0)
			, allocations: Number(leak?.[2] ?? 0)
			, unchangedAfterConversions: true
			, report: normalize(baseline.stderr).replaceAll(output, "<release>").replaceAll(working, "<probes>") }
		, trackedLiveAllocationsAfterEveryFailure: 0
		, sources, consumerSha256: sha256(consumerSource)
		, executableSha256: sha256(await readFile(command)) };
};
