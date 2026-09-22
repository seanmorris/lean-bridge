/**
 * Isolated allocation and malformed-output probes over real compiled Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { nativeCollectionConsumer, nativeCollectionElementChecks } from "./native-collection-consumers.mjs";

const declarations = "#include <stddef.h>\nvoid* probe_malloc(size_t);\nvoid* probe_calloc(size_t,size_t);\nvoid* probe_realloc(void*,size_t);\nvoid probe_free(void*);\n";
const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-g", "-no-pie"];
const sanitizerEnvironment = { ...copiedCleanEnvironment
	, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
	, LSAN_OPTIONS: "exitcode=0"
	, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" };
const normalize = value => value.replace(/==\d+==/g, "==PID==").replace(/0x[0-9a-f]+/g, "ADDRESS");
const deep = () => `uint32_t leaf=77;
  ${Array.from({ length: 24 }, (_, i) => `collections_${"array_".repeat(i + 1)}uint32_span deep${i + 1}={${i ? `&deep${i}` : "&leaf"},1,NULL,NULL};`).join("\n  ")}
  FAULTS(collections_${"array_".repeat(24)}uint32_span,collections_deep(&deep24,&out,&error),out${".data[0]".repeat(24)}==77);`;
const sanitized = async (executable, working, source, instrumented, consumer, profile, output, probes) => {
	const baseline = await runCopied(executable, ["--startup-only"], working, sanitizerEnvironment);
	// Both Lean predicates retain lazily initialized numeric constants in once-cells.
	// Keep the untouched startup report and independently check for growth after warmup.
	const warmed = await runCopied(executable, ["--warmup"], working, sanitizerEnvironment);
	const repeated = await runCopied(executable, ["--warmup-many"], working, sanitizerEnvironment);
	const result = await runCopied(executable, [], working, sanitizerEnvironment);
	assert.equal(normalize(repeated.stderr), normalize(warmed.stderr), "Repeated fixture initialization grew the sanitizer report");
	assert.equal(normalize(result.stderr), normalize(warmed.stderr), "Conversions changed the initialized-fixture leak report");
	const report = text => {
		assert.doesNotMatch(text, /ERROR: AddressSanitizer|runtime error:/);
		const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/.exec(text);
		if(text)
		{ assert.ok(leak, text); assert.match(text, /__gmp_default_allocate/); }
		return { bytes: Number(leak?.[1] ?? 0), allocations: Number(leak?.[2] ?? 0)
			, report: normalize(text).replaceAll(output, "<release>").replaceAll(probes, "<probes>") };
	};
	const match = /^collection-fault-ok:(\d+):(\d+):(\d+):(\d+)\n$/.exec(result.stdout);
	assert.ok(match, result.stdout);
	const [checks, allocationFailures, rejected, extra] = match.slice(1).map(Number);
	assert.ok(allocationFailures > 200 && rejected >= 10);
	assert.equal(extra, 16);
	return { checks, allocationFailures, rejected
		, [profile === "native" ? "malformedNativeScalars" : "previousPayloadsReleased"]: extra
		, realLeanExecution: true, allocatorUnderTest: profile
		, syntheticScalarInjection: profile === "native"
		, trackedLiveAllocationsAfterEveryFailure: 0
		, sanitizers: ["address", "leak", "undefined"]
		, startupLeakBaseline: report(baseline.stderr)
		, warmedLeakBaseline: { ...report(warmed.stderr)
			, setupCalls: ["record_inspect", "array_check_elements"]
			, warmupRepetitions: 1000, unchangedAfterRepeatedWarmup: true
			, unchangedAfterConversions: true }
		, adapterSha256: sha256(source), probeAdapterSha256: sha256(instrumented)
		, consumerSha256: sha256(consumer)
		, executableSha256: sha256(await readFile(executable)) };
};

/**
 * Interpose bridge/native and public C facade allocations in separate binaries.
 *
 * @param output - Fresh collection release, before author removal.
 * @param working - Task-owned isolated probe directory.
 * @param environment - Explicit producer compiler environment.
 */
export const checkNativeCollectionFaults = async (output, working, environment) => {
	const binding = join(output, "native/c-binding");
	const component = join(output, "native/component"), runtime = join(output, "native/runtime");
	const receipt = JSON.parse(await readFile(join(component, "native-component.json")));
	const nativeRoot = join(working, "native"), gmpRoot = join(working, "gmp");
	const source = await readFile(join(binding, "src/native.c"), "utf8");
	const charCheck = "if (value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return -2;";
	assert.equal(source.split(charCheck).length, 2);
	const instrumented = declarations + "extern int probe_bad_char;\n" + source
		.replace(charCheck, `if (probe_bad_char) { value = 0xd800; }\n  ${charCheck}`)
		.replace(/\b(malloc|calloc|realloc|free)\b/g, "probe_$1");
	const consumer = (await readFile("tests/fixtures/collection-consumers/native-probe.c", "utf8"))
		.replace("/* deep faults */", deep()).replace("/* independent Lean element checks */", nativeCollectionElementChecks());
	await saveLakeFile(nativeRoot, "adapter.c", instrumented); await saveLakeFile(nativeRoot, "probe.c", consumer);
	const executable = join(nativeRoot, "probe");
	await runCopied("/usr/bin/cc", [...flags
		, "-I", join(binding, "include"), "-I", join(binding, "internal")
		, "-I", component, "-I", join(runtime, "include")
		, "adapter.c", "probe.c", join(binding, "src/collections.c")
		, "-L", component, "-L", join(runtime, "lib")
		, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
		, `-Wl,-rpath,${component}`
		, `-Wl,-rpath,${join(runtime, "lib")}`
		, "-o", executable], nativeRoot, environment);
	const native = await sanitized(executable, nativeRoot, source, instrumented, consumer, "native", output, working);
	await rm(nativeRoot, { recursive: true, force: true });

	const gmp = join(binding, "gmp"), lib = join(gmpRoot, "lib");
	const facade = await readFile(join(gmp, "src/collections_gmp.c"), "utf8");
	const facadeProbe = declarations + facade.replace(/\b(malloc|calloc|free)\b/g, "probe_$1");
	const publicConsumer = await nativeCollectionConsumer("c");
	const faults = (await readFile("tests/fixtures/collection-consumers/gmp-probe.c", "utf8"))
		.replace("/* independent Lean element checks */", nativeCollectionElementChecks());
	assert.equal(publicConsumer.split("int main(void) {").length, 2);
	const gmpConsumer = publicConsumer.slice(0, publicConsumer.indexOf("int main(void) {")) + faults + `
int main(int argc,char** argv) {
  if(argc==2&&!strcmp(argv[1],"--startup-only"))return 0;
  for(unsigned i=0;i<(argc==2&&!strcmp(argv[1],"--warmup-many")?1000u:1u);++i)warm_constants();
  if(argc==2&&(!strcmp(argv[1],"--warmup")||!strcmp(argv[1],"--warmup-many")))return 0;
  arrays(); records(); deep(); ownership(); CHECK(live==0); faults(); CHECK(live==0);
  printf("collection-fault-ok:%zu:%zu:%zu:%zu\\n",checks,failures,rejected,releases);
}
`;
	await saveLakeFile(gmpRoot, "facade.c", facadeProbe); await saveLakeFile(gmpRoot, "probe.c", gmpConsumer);
	await cp(join(runtime, "lib"), lib, { recursive: true });
	await cp(join(component, receipt.library), join(lib, receipt.library));
	await cp(join(binding, "lib/libcollections.so"), join(lib, "libcollections.so"));
	await cp(join(gmp, "lib/libgmp.so.10"), join(lib, "libgmp.so.10"));
	await runCopied("/usr/bin/cc", [...flags
		, "-I", join(binding, "include"), "-I", join(gmp, "include")
		, "-c", "facade.c", "-o", "facade.o"], gmpRoot, environment);
	const gmpExecutable = join(gmpRoot, "probe");
	await runCopied("/usr/bin/cc", [...flags, "-I", join(gmp, "include")
		, "probe.c", "facade.o", "-L", lib, "-Wl,-rpath,$ORIGIN/lib"
		, "-lcollections", "-l:libgmp.so.10"
		, "-o", gmpExecutable], gmpRoot, environment);
	const cFacade = await sanitized(gmpExecutable, gmpRoot, facade, facadeProbe, gmpConsumer, "gmp", output, working);
	await rm(gmpRoot, { recursive: true, force: true });
	return { native, cFacade };
};
