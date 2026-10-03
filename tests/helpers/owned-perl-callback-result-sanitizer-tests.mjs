/**
 * Instrument actual Perl XS, native ownership, broker and compiler-emitted C.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { brokerSource } from "../../src/backends/native/runtime-broker.mjs";
import { nativeCallbackBroker } from "../../src/backends/native/callback-broker.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { prepareOwnedPerlNative } from "./owned-perl-native.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const execute = promisify(execFile);
const environment = { PATH: "/usr/bin:/bin" };
const flags = ["-O1", "-g", "-fPIC", "-fsanitize=address,undefined", "-fno-omit-frame-pointer"];
const nativeControls = `
__attribute__((noinline)) static void *sanitizer_allocate(size_t bytes) { return malloc(bytes); }
void sanitizer_native_address(size_t index) {
  volatile char *value = sanitizer_allocate(1); value[index] = 1; free((void *)value);
}
int sanitizer_native_undefined(int shift) { volatile int value = 1; return value << shift; }
void sanitizer_native_leak(void) { volatile char *value = sanitizer_allocate(73); if (value) *value = 1; }
`;
const xsControls = `
MODULE = LeanBridge::OwnedProbe PACKAGE = LeanBridge::OwnedProbe

void
sanitizer_native_address(index)
    UV index
  PPCODE:
    sanitizer_native_address(index);

int
sanitizer_native_undefined(shift)
    int shift
  CODE:
    RETVAL = sanitizer_native_undefined(shift);
  OUTPUT:
    RETVAL

void
sanitizer_native_leak()
  PPCODE:
    sanitizer_native_leak();

void
sanitizer_xs_address(index)
    UV index
  PPCODE:
    volatile char *value = sanitizer_xs_allocate(1); value[index] = 1; free((void *)value);

int
sanitizer_xs_undefined(shift)
    int shift
  CODE:
    volatile int value = 1; RETVAL = value << shift;
  OUTPUT:
    RETVAL

void
sanitizer_xs_leak()
  PPCODE:
    volatile char *value = sanitizer_xs_allocate(73); if (value) *value = 1;
`;
const xsPrefix = `#include <stddef.h>
#include <stdlib.h>
void sanitizer_native_address(size_t);
int sanitizer_native_undefined(int);
void sanitizer_native_leak(void);
__attribute__((noinline)) static void *sanitizer_xs_allocate(size_t bytes) { return malloc(bytes); }
`;
const fingerprintCode = 'print JSON::PP->new->canonical->encode({perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0})';
const positiveModes = ["cold", "runtime", "faults", "process-reentry", "reentrant-shutdown"];
const controlModes = ["native-address", "xs-address", "native-undefined", "xs-undefined"];
const asanMallocFrame = / in (?:__interceptor_)?malloc (?:\.\.\/)*src\/libsanitizer\/asan\/asan_malloc_linux\.cpp:[1-9][0-9]*(?::[1-9][0-9]*)?$/u;
const checkAsanMallocFrame = () => {
	for(const name of ["__interceptor_malloc", "malloc"])
		assert.match(`    #0 <address> in ${name} ../../../../src/libsanitizer/asan/asan_malloc_linux.cpp:69`, asanMallocFrame);
	for(const invalid of [
		"    #0 <address> in malloc user.c:69"
		, "    #0 <address> in calloc ../../../../src/libsanitizer/asan/asan_malloc_linux.cpp:69"
		, "    #0 <address> in __interceptor_malloc ../../../../src/libsanitizer/asan/asan_malloc_linux.cpp:0"
	]) assert.doesNotMatch(invalid, asanMallocFrame);
};
// Only the exact observed LSan tracer failure is a recognized unavailable
// diagnostic. Other signals, errors and partial reports remain test failures.
const unavailableLsan = /^Tracer caught signal 11: addr=0x[0-9a-f]+ pc=0x[0-9a-f]+ sp=0x[0-9a-f]+\n==(?<pid>\d+)==LeakSanitizer has encountered a fatal error\.\n==\k<pid>==HINT: For debugging, try setting environment variable LSAN_OPTIONS=verbosity=1:log_threads=1\n==\k<pid>==HINT: LeakSanitizer does not work under ptrace \(strace, gdb, etc\)\n$/u;
const checkUnavailableDiagnostic = () => {
	for(const address of ["0xc0", "0xd0"])
	{
		// Unit fixtures for the exact observed family, not execution evidence.
		const diagnostic = `Tracer caught signal 11: addr=${address} pc=0x123 sp=0x456\n==123==LeakSanitizer has encountered a fatal error.\n==123==HINT: For debugging, try setting environment variable LSAN_OPTIONS=verbosity=1:log_threads=1\n==123==HINT: LeakSanitizer does not work under ptrace (strace, gdb, etc)\n`;
		assert.match(diagnostic, unavailableLsan);
		for(const unknown of [
			"Segmentation fault (core dumped)\n"
			, "ERROR: AddressSanitizer: heap-use-after-free\n"
			, diagnostic.replace("signal 11", "signal 6")
			, diagnostic.replace("==123==HINT:", "==124==HINT:")
			, diagnostic.replace("fatal error.", "heap-use-after-free.")
			, diagnostic + "unexpected diagnostic\n"
		]) assert.doesNotMatch(unknown, unavailableLsan);
	}
};
// Parse only a complete leak report. Baseline comparison ignores process
// addresses, not allocation counts, source sites, frame order or extra errors.
const strictLeakBlocks = diagnostic => {
	const matched = /^\n={65}\n==[1-9][0-9]*==ERROR: LeakSanitizer: detected memory leaks\n\n([^]+)\n\nSUMMARY: AddressSanitizer: ([1-9][0-9]*) byte\(s\) leaked in ([1-9][0-9]*) allocation\(s\)\.\n$/u.exec(diagnostic);
	assert.ok(matched, "complete strict LSan diagnostic");
	const blocks = matched[1].split("\n\n").map(block => {
		const fields = /^(Direct|Indirect) leak of ([1-9][0-9]*) byte\(s\) in ([1-9][0-9]*) object\(s\) allocated from:\n([^]+)$/u.exec(block);
		assert.ok(fields, "complete strict LSan allocation");
		const frames = fields[4].split("\n").map((line, index) => {
			assert.match(line, new RegExp("^ {4}#" + index + " 0x[0-9a-f]+ in [A-Za-z0-9_]+ [^\\n]+$", "u"));
			return line.replaceAll(/0x[0-9a-f]+/gu, "<address>");
		});
		return { kind: fields[1], bytes: Number(fields[2])
			, allocations: Number(fields[3]), frames };
	});
	assert.equal(blocks.reduce((sum, block) => sum + block.bytes, 0), Number(matched[2]));
	assert.equal(blocks.reduce((sum, block) => sum + block.allocations, 0), Number(matched[3]));
	return blocks;
};

for(const mode of ["ordinary", "reviewed"])
test(`Perl callback-result ASan and UBSan instrument actual C and XS (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1200000
}, async t => {
	checkUnavailableDiagnostic();
	checkAsanMallocFrame();
	const options = { hostCallbacks: true, callbackResultAnchors: true
		, transferredInputs: true, anchoredResults: true, receiverExports: true };
	const compiled = await prepareOwnedPerlNative(t, {
		...(mode === "ordinary" ? { configuration: await ownedDotnetCallbackResultCombinedConfiguration() }
			: { reviewedIr: ownedDotnetCallbackResultCombinedReviewedIr() })
		, sourceSuffix: ownedDotnetCallbackResultCombinedSource
		, ...options
		, evidenceName: `perl-callback-result-sanitizers-${mode}-inputs.json`
	});
	assert.equal(Boolean(compiled.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const report = {
		schemaVersion: 1, kind: "owned-perl-callback-result-sanitizers"
		, mode
		, installedPackage: false, options, sources: {}
		, commands: [], observations: []
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
		, instrumented: [
			"native ownership adapter", "shared native broker", "generated Perl XS"
			, "compiler-emitted Owned.c", "compiler-emitted Carriers.c"
			, "compiler-emitted Witness.c", "generated Callbacks.c"]
		, uninstrumented: ["prebuilt Perl interpreter and standard XS modules", "prebuilt Lean runtime", "GMP"]
		, coverage: {
			addressAndUndefined: "fail-fast executions with leak detection disabled"
			, ownershipCleanup: "six explicit counters, separate from sanitizer coverage"
			, leakSanitizer: "not clean or detector unavailable: strict diagnostics retained separately; no leak-free claim"
			, forkChild: "foreign-context checks use _exit without a child leak checkpoint"
		}
	};
	const saveReport = () => saveLakeFile(resolve("build/owned-perl-callback-result-sanitizers"), `${mode}.json`, canonicalJson(report));
	const capture = async (command, args, env = environment) => {
		const execution = await execute(command, args, { cwd: compiled.directory, env
			, timeout: 180000, maxBuffer: 32 * 1024 * 1024 })
			.then(({ stdout, stderr }) => ({ code: 0, signal: null, stdout, stderr })
				, error => ({ code: error.code ?? null, signal: error.signal ?? null
					, stdout: error.stdout ?? "", stderr: error.stderr ?? ""
					, message: error.message }));
		const result = { command, args, environment: env, execution };
		report.commands.push(result); await saveReport(); return result;
	};
	const build = async (command, args) => {
		const result = await capture(command, args);
		assert.equal(result.execution.code, 0, result.execution.stderr); return result;
	};
	const save = async (path, source) => {
		await saveLakeFile(compiled.directory, path, source);
		report.sources[path] = { source, sha256: sha256(source) };
	};
	for(const [file, path] of [
		["consumer.pl", "owned-perl-callback-result-sanitizers.pl"]
		, ["runtime.pl", "owned-perl-callback-results.pl"]
		, ["faults.pl", "owned-perl-callback-result-faults.pl"]
		, ["lifetime.pl", "owned-perl-callback-result-lifetime.pl"]
	]) await save(file, await readFile("tests/fixtures/structured-types/" + path, "utf8"));
	await save("sanitized/broker.c", `${brokerSource}\n${nativeCallbackBroker}`);
	await save("sanitized/public-api.c", compiled.native + nativeControls);
	await save("sanitized/Probe.xs", xsPrefix + compiled.xs + xsControls);
	await save("sanitized/lib/.keep", "");
	const headers = Object.keys(compiled.c.files).filter(path => path.endsWith(".h"))
		.map(path => path.split("/").at(-1));
	for(const path of ["instrumentation.h", "carriers.h", ...headers])
	{
		const source = await readFile(join(compiled.directory, path), "utf8");
		report.sources[path] = { source, sha256: sha256(source) };
	}
	report.prebuiltRuntimeManifest = JSON.parse(await readFile(join(compiled.directory, "runtime/runtime.json"), "utf8"));
	for(const name of ["Owned", "Carriers", "Witness", "Callbacks"])
	{
		const source = await readFile(join(compiled.directory, name + ".c"), "utf8");
		report.sources[name + ".c"] = { source, sha256: sha256(source) };
		await build("/usr/bin/cc", [...flags, "-I", "runtime/include"
			, ...name === "Carriers" ? ["-include", "carriers.h"] : []
			, "-c", name + ".c", "-o", "sanitized/" + name + ".o"]);
	}
	await build("/usr/bin/cc", [
		...flags, "-shared", "-pthread", "-I", "runtime/include"
		, "sanitized/broker.c", "-L", "runtime/lib"
		, "-Wl,--no-as-needed", "-lleanshared"
		, "-Wl,-z,defs", "-Wl,-soname,liblean_bridge_native.so"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "sanitized/lib/liblean_bridge_native.so"]);
	await build("/usr/bin/cc", [
		"-std=c11", ...flags, "-shared", "-Wall", "-Wextra", "-Werror"
		, "-I", ".", "-I", "runtime/include", "sanitized/public-api.c"
		, ...["Owned", "Carriers", "Witness", "Callbacks"].map(name => "sanitized/" + name + ".o")
		, "-L", "sanitized/lib", "-L", "runtime/lib"
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,-z,defs"
		, "-Wl,-rpath," + join(compiled.directory, "sanitized/lib") + ":" + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-perl.so"]);
	const libraries = [];
	for(const name of ["libasan.so", "libubsan.so"])
	{
		const result = await build("/usr/bin/cc", ["-print-file-name=" + name]);
		const path = result.execution.stdout.trim(); assert.ok(path.startsWith("/"));
		libraries.push({ path, sha256: sha256(await readFile(path)) });
	}
	const strictLeakEnvironment = { ...environment, LD_PRELOAD: libraries.map(item => item.path).join(":")
		, PERL_DESTRUCT_LEVEL: "2"
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
		, LSAN_OPTIONS: "exitcode=23" };
	const sanitizerEnvironment = { ...strictLeakEnvironment, ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1" };
	report.sanitizerEnvironment = sanitizerEnvironment; report.sanitizerLibraries = libraries;
	report.strictLeakEnvironment = strictLeakEnvironment;
	await save("sanitized/build.pl", `use strict; use warnings;
use ExtUtils::ParseXS; use ExtUtils::CBuilder; use Cwd qw(getcwd);
ExtUtils::ParseXS::process_file(filename => 'sanitized/Probe.xs', output => 'sanitized/Probe.c', prototypes => 0);
my $builder = ExtUtils::CBuilder->new(quiet => 1);
my $object = $builder->compile(source => 'sanitized/Probe.c', include_dirs => ['.'],
  extra_compiler_flags => '-std=gnu11 -O1 -g -Wall -Wextra -Werror -Wno-unused-function -fsanitize=address,undefined -fno-omit-frame-pointer');
use File::Path qw(make_path); make_path('auto/LeanBridge/OwnedProbe');
$builder->link(objects => [$object], module_name => 'LeanBridge::OwnedProbe',
  lib_file => 'auto/LeanBridge/OwnedProbe/OwnedProbe.so',
  extra_linker_flags => '-L. -lowned-perl -Wl,-rpath,' . getcwd() . ' -pthread -lgmp -fsanitize=address,undefined');
`);
	for(const perl of perlGraphCommands())
	{
		const fingerprintExecution = await build(perl, ["-MConfig", "-MJSON::PP", "-e", fingerprintCode]);
		const fingerprint = JSON.parse(fingerprintExecution.execution.stdout);
		await build(perl, ["sanitized/build.pl"]);
		const xsC = await readFile(join(compiled.directory, "sanitized/Probe.c"), "utf8");
		const observation = { perl, fingerprintExecution, fingerprint, xsC
			, xsCSha256: sha256(xsC), executions: [], strictLeakExecutions: [] };
		report.observations.push(observation); await saveReport();
		// Preserve the actual cold interpreter contrast: full destruction releases
		// Perl's global arenas, without suppressing any LeakSanitizer diagnostics.
		const { PERL_DESTRUCT_LEVEL: destructLevel, ...defaultDestruction } = strictLeakEnvironment;
		assert.equal(destructLevel, "2");
		observation.coldPerlDefault = await capture(perl, ["-MConfig", "-MJSON::PP", "-e", fingerprintCode], defaultDestruction);
		observation.coldPerlFull = await capture(perl, ["-MConfig", "-MJSON::PP", "-e", fingerprintCode], strictLeakEnvironment);
		for(const variant of [...positiveModes, "native-leak", "xs-leak"])
		{
			const result = await capture(perl, ["-I.", "consumer.pl", variant], strictLeakEnvironment);
			const leakStatus = unavailableLsan.test(result.execution.stderr) ? "detector-unavailable" : "not-clean";
			observation.strictLeakExecutions.push({ variant, ...result, leakStatus }); await saveReport();
		}
		for(const variant of [...positiveModes, ...controlModes])
		{
			const result = await capture(perl, ["-I.", "consumer.pl", variant], sanitizerEnvironment);
			observation.executions.push({ variant, ...result }); await saveReport();
		}
		assert.equal(observation.coldPerlFull.execution.code, 0, observation.coldPerlFull.execution.stderr);
		assert.equal(observation.coldPerlFull.execution.stderr, "");
		for(const item of observation.executions)
		{
			if(positiveModes.includes(item.variant))
			{
				assert.equal(item.execution.code, 0, `${item.variant}: ${item.execution.stderr}`);
				assert.equal(item.execution.stderr, "");
				const observed = JSON.parse(item.execution.stdout); item.observed = observed;
				assert.equal(observed.perlVersion, fingerprint.perlVersion); assert.equal(observed.threaded, fingerprint.threaded);
				if(item.variant === "runtime")
				{
					assert.equal(observed.checks, 92);
					for(const key of ["managedLive", "nativeLive", "identities", "owners", "active", "cleanupStatus"])
						assert.equal(observed[key], 0);
				}
				else assert.deepEqual(observed.final, [0, 0, 0, 0, 0, 0]);
			}
			else
			{
				assert.notEqual(item.execution.code, 0, item.variant);
				assert.match(item.execution.stderr, item.variant.endsWith("-address")
					? /ERROR: AddressSanitizer: heap-buffer-overflow/u : /runtime error: shift exponent 40 is too large/u);
				assert.match(item.execution.stderr, item.variant.startsWith("native-") ? /sanitized\/public-api\.c/u : /sanitized\/Probe\.xs/u);
			}
		}
		// These are deliberately NOT clean sanitizer executions. Keep their real
		// failure status and exact diagnostics, including the upstream baseline.
		const cold = observation.strictLeakExecutions[0];
		assert.equal(cold.leakStatus, "not-clean", "cold LSan detector unavailable: cannot invent a per-ABI baseline");
		const baseline = strictLeakBlocks(cold.execution.stderr);
		for(const block of baseline)
		{
			assert.equal(block.kind, "Direct"); assert.equal(block.frames.length, 2);
			assert.match(block.frames[0], asanMallocFrame);
			assert.ok(block.frames[1].includes(` in __gmp_default_allocate (${compiled.directory}/runtime/lib/libleanshared.so+`));
		}
		const observedBaseline = {
			bytes: baseline.reduce((sum, block) => sum + block.bytes, 0)
			, allocations: baseline.reduce((sum, block) => sum + block.allocations, 0)
			, source: "prebuilt Lean/GMP"
		};
		for(const item of observation.strictLeakExecutions)
		{
			assert.equal(item.execution.code, 23, item.execution.stderr);
			if(item.leakStatus === "detector-unavailable")
			{
				assert.match(item.execution.stderr, unavailableLsan);
				continue; // No allocation-baseline equality or leak result is claimed.
			}
			const blocks = strictLeakBlocks(item.execution.stderr);
			item.observedBaseline = observedBaseline;
			if(item.variant.endsWith("-leak"))
			{
				const name = item.variant === "native-leak" ? "sanitizer_native_leak" : "XS_LeanBridge__OwnedProbe_sanitizer_xs_leak";
				const file = item.variant === "native-leak" ? "sanitized/public-api.c" : "sanitized/Probe.xs";
				const needle = item.variant === "native-leak" ? "void sanitizer_native_leak(void) {" : "sanitizer_xs_allocate(73);";
				const lines = report.sources[file].source.split("\n").flatMap((line, index) => line.includes(needle) ? [index + 1] : []);
				assert.equal(lines.length, 1);
				const control = blocks.filter(block => block.frames.some(frame => frame.endsWith(` in ${name} ${file}:${lines[0]}`)));
				assert.equal(control.length, 1); assert.equal(control[0].kind, "Direct");
				assert.equal(control[0].bytes, 73); assert.equal(control[0].allocations, 1);
				assert.deepEqual(blocks.filter(block => !control.includes(block)), baseline);
			}
			else assert.deepEqual(blocks, baseline);
		}
		await saveReport();
		const unavailable = observation.strictLeakExecutions.filter(item => item.leakStatus === "detector-unavailable").length;
		t.diagnostic(`${perl}: 5 address/UB executions + 4 native/XS detector controls; strict LSan ${7 - unavailable} NOT CLEAN, ${unavailable} DETECTOR UNAVAILABLE`);
	}
});
