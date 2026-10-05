/**
 * Exercise the real Ruby/Fiddle boundary with instrumented C and detector controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename, join } from "node:path";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Preserve complete allocation stacks and counts while normalizing addresses.
 *
 * @param text - Complete sanitizer output.
 * @param directory - Test-owned native fixture root.
 */
export const normalizeOwnedRubySanitizer = (text, directory) => text.replace(/==\d+==/gu, "==PID==")
	.replace(/(?<!\+)0x[0-9a-f]+/gu, "ADDRESS").replaceAll(directory, "<probe>")
	.split("\n\n").map(block => block.trim()).filter(Boolean).sort().join("\n\n");

/**
 * Compile and execute the same runtime probe, plus positive sanitizer controls.
 *
 * @param compiled - Fresh Lean and native adapter fixture.
 * @param hostCallbacks - Include compiled host callback carriers.
 * @param ruby - MRI executable under test.
 * @param expected - Unsanitized runtime observation.
 */
export const runOwnedRubyCallbackSanitizers = async (compiled, hostCallbacks, ruby, expected) => {
	const environment = { PATH: "/usr/bin:/bin" };
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-fsanitize=address,undefined", "-fno-omit-frame-pointer"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o"
		, ...hostCallbacks ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-ruby-callback-results-sanitized.so"]
	, compiled.directory, environment);
	const libraries = [];
	for(const name of ["libasan.so", "libubsan.so"])
	{
		const path = (await runCopied("/usr/bin/cc", ["-print-file-name=" + name], compiled.directory, environment)).stdout.trim();
		assert.ok(path.startsWith("/")); libraries.push(path);
	}
	const sanitizerEnvironment = { ...environment, LD_PRELOAD: libraries.join(":")
		, LEAN_BRIDGE_OWNED_SANITIZER_CHECK: "1"
		, RUBY_FREE_AT_EXIT: "1"
		// Avoid GCC 12's obsolete glibc TLS-header heuristic. The held/cleared
		// controls below still require dynamic-TLS root scanning to work.
		// MRI owns its signal stack. ASan must not unmap MRI's malloc-backed stack
		// when a thread exits: https://bugs.ruby-lang.org/issues/20256.
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1:malloc_context_size=8:intercept_tls_get_addr=0:use_sigaltstack=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
		, LSAN_OPTIONS: "exitcode=0" };
	const run = extra => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"'
		, "ruby-callback-results", ruby, "--disable-gems", "consumer.rb"
		, join(compiled.directory, "libowned-ruby-callback-results-sanitized.so")]
	, compiled.directory, { ...sanitizerEnvironment, ...extra });
	const cold = await run({ LEAN_BRIDGE_OWNED_COLD_ONLY: "1" }), exercised = await run({});
	await saveLakeFile("build/owned-ruby-callback-results/diagnostics", basename(compiled.directory) + ".json"
		, JSON.stringify({ cold, exercised }, null, 2));
	const normalize = text => normalizeOwnedRubySanitizer(text, compiled.directory);
	for(const result of [cold, exercised])
	{
		assert.doesNotMatch(result.stderr, /ERROR: AddressSanitizer|runtime error:|Tracer caught|fatal error/u);
	}
	assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
	assert.deepEqual(JSON.parse(exercised.stdout), expected);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	const sanitizerProbes = [];
	const detectors = [
		["address", /ERROR: AddressSanitizer: heap-buffer-overflow/u]
		, ["undefined", /runtime error: shift exponent 40 is too large/u]
	];
	for(const [fault, diagnostic] of detectors)
	{
		const broken = await run({ LEAN_BRIDGE_OWNED_SANITIZER_FAULT: fault
			, ...fault === "address" ? { UBSAN_OPTIONS: "halt_on_error=0" } : {} })
			.catch(error => { assert.equal(error.code, "build-command-failed"); return error.details; });
		assert.match(broken.stderr, diagnostic);
		assert.doesNotMatch(broken.stdout, /"checks":/u);
		sanitizerProbes.push({ fault, rejected: true, diagnostic: normalize(broken.stderr) });
	}
	const leaked = await run({ LEAN_BRIDGE_OWNED_SANITIZER_FAULT: "leak" });
	assert.deepEqual(JSON.parse(leaked.stdout), { leaked: true });
	assert.match(leaked.stderr, /Direct leak of 73 byte\(s\) in 1 object\(s\)/u);
	assert.notEqual(normalize(leaked.stderr), normalize(cold.stderr));
	sanitizerProbes.push({ fault: "leak", rejected: true, diagnostic: normalize(leaked.stderr) });
	const held = await run({ LEAN_BRIDGE_OWNED_SANITIZER_FAULT: "tls-live" });
	assert.deepEqual(JSON.parse(held.stdout), { tls: "live" });
	assert.equal(normalize(held.stderr), normalize(cold.stderr));
	sanitizerProbes.push({ fault: "tls-live", reachable: true, diagnostic: normalize(held.stderr) });
	const tlsLeak = await run({ LEAN_BRIDGE_OWNED_SANITIZER_FAULT: "tls-leak" });
	assert.deepEqual(JSON.parse(tlsLeak.stdout), { tls: "leak" });
	assert.match(tlsLeak.stderr, /Direct leak of 89 byte\(s\) in 1 object\(s\)/u);
	assert.doesNotMatch(tlsLeak.stderr, /Tracer caught|fatal error/u);
	assert.notEqual(normalize(tlsLeak.stderr), normalize(cold.stderr));
	sanitizerProbes.push({ fault: "tls-leak", rejected: true, diagnostic: normalize(tlsLeak.stderr) });
	return { nativeSanitizers: ["address", "undefined"]
		, leakCheckpoint: "after-interpreter-shutdown"
		, startupLeakBaseline: normalize(cold.stderr)
		, exercisedLeakReport: normalize(exercised.stderr)
		, sanitizedObservation: JSON.parse(exercised.stdout)
		, sanitizerEnvironment, sanitizerProbes };
};
