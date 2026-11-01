/**
 * Run the actual Python boundary under instrumented C, including detector probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Ignore process addresses and group order, preserving allocation evidence.
 *
 * @param text - Complete sanitizer diagnostic.
 * @param directory - Exclusively owned probe root.
 */
export const normalizeOwnedPythonSanitizer = (text, directory) => text.replace(/==\d+==/gu, "==PID==")
	.replace(/(?<!\+)0x[0-9a-f]+/gu, "ADDRESS")
	.replaceAll(directory, "<probe>")
	// Equal-sized leak groups can arrive in a different address order.
	// Keep each complete stack, byte count and object count unchanged.
	.split("\n\n").map(block => block.trim()).filter(Boolean).sort().join("\n\n");

const cpythonUnicodeStartupLeak = block => {
	const lines = block.split("\n").map(line => line.trim());
	return lines.length === 4
		&& /^Direct leak of \d+ byte\(s\) in \d+ object\(s\) allocated from:$/u.test(lines[0])
		&& /^#0 ADDRESS in malloc .*\/asan_malloc_linux\.cpp:\d+$/u.test(lines[1])
		&& /^#1 ADDRESS in PyUnicode_New Objects\/unicodeobject\.c:\d+$/u.test(lines[2])
		&& /^#2 ADDRESS in (?:_PyUnicode_FromASCII|_PyUnicode_FromUCS1|unicode_decode_utf8) Objects\/unicodeobject\.c:\d+$/u.test(lines[3]);
};

/**
 * Compare executions without treating CPython's variable startup cache as an
 * application leak. Full diagnostics remain in the evidence; this projection
 * removes only exact three-frame CPython Unicode allocations and their derived
 * total. Any native/generated frame or additional stack frame remains visible.
 *
 * @param text - Complete sanitizer diagnostic.
 * @param directory - Exclusively owned probe root.
 */
export const comparableOwnedPythonSanitizerBaseline = (text, directory) =>
	normalizeOwnedPythonSanitizer(text, directory).split("\n\n")
		.filter(block => !cpythonUnicodeStartupLeak(block))
		.filter(block => !/^SUMMARY: AddressSanitizer: \d+ byte\(s\) leaked in \d+ allocation\(s\)\.$/u.test(block))
		.join("\n\n");

/**
 * Compile once, then compare each interpreter with its own cold leak baseline.
 *
 * @param compiled - Fresh Lean, C and native runtime fixture.
 * @param hostCallbacks - Include the compiled host callback carrier.
 */
export const prepareOwnedPythonCallbackSanitizers = async (compiled, hostCallbacks) => {
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
		, "-o", "libowned-python-callback-results-sanitized.so"]
	, compiled.directory, environment);
	const sanitizerLibraries = [];
	for(const library of ["libasan.so", "libubsan.so"])
	{
		const path = (await runCopied("/usr/bin/cc", ["-print-file-name=" + library], compiled.directory, environment)).stdout.trim();
		assert.ok(path.startsWith("/"), path); sanitizerLibraries.push(path);
	}
	const sanitizerEnvironment = { ...environment
		, LD_PRELOAD: sanitizerLibraries.join(":")
		, PYTHONMALLOC: "malloc"
		, LEAN_BRIDGE_OWNED_SANITIZER_CHECK: "1"
		// GCC 12 guesses a pre-release glibc TLS header from page alignment and
		// can register an unmapped DTLS range. Keep static TLS and loader-allocated
		// roots enabled; the held/cleared dynamic TLS probes below verify coverage.
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1:malloc_context_size=8:intercept_tls_get_addr=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1"
		, LSAN_OPTIONS: "exitcode=0" };
	return async (interpreter, expected) => {
		const run = extra => runCopied("/bin/sh", [
			"-c", 'ulimit -c 0\nexec "$@"', "python-callback-results"
			// -I would ignore PYTHONMALLOC. The allowlisted environment, -s and
			// -P retain user-site and current-directory import isolation.
			, interpreter.command, "-s", "-P", "-B", "probe.py"
			, join(compiled.directory, "libowned-python-callback-results-sanitized.so")]
		, interpreter.directory, { ...sanitizerEnvironment, ...extra });
		const cold = await run({ LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
		const observed = await run({});
		assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
		assert.deepEqual(JSON.parse(observed.stdout), expected);
		const normalize = text => normalizeOwnedPythonSanitizer(text, compiled.directory);
		const comparable = text => comparableOwnedPythonSanitizerBaseline(text, compiled.directory);
		for(const result of [cold, observed])
			assert.doesNotMatch(result.stderr, /ERROR: AddressSanitizer|runtime error:|Tracer caught|fatal error/u);
		assert.equal(comparable(observed.stderr), comparable(cold.stderr));
		const sanitizerProbes = [];
		for(const [fault, diagnostic] of [
			["address", /ERROR: AddressSanitizer: heap-buffer-overflow/u]
			, ["undefined", /runtime error: shift exponent 40 is too large/u]
		]) {
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
		assert.equal(comparable(held.stderr), comparable(cold.stderr));
		sanitizerProbes.push({ fault: "tls-live", reachable: true, diagnostic: normalize(held.stderr) });
		const tlsLeak = await run({ LEAN_BRIDGE_OWNED_SANITIZER_FAULT: "tls-leak" });
		assert.deepEqual(JSON.parse(tlsLeak.stdout), { tls: "leak" });
		assert.match(tlsLeak.stderr, /Direct leak of 89 byte\(s\) in 1 object\(s\)/u);
		assert.doesNotMatch(tlsLeak.stderr, /Tracer caught|fatal error/u);
		assert.notEqual(normalize(tlsLeak.stderr), normalize(cold.stderr));
		sanitizerProbes.push({ fault: "tls-leak", rejected: true, diagnostic: normalize(tlsLeak.stderr) });
		return { nativeSanitizers: ["address", "undefined"]
			, startupLeakBaseline: normalize(cold.stderr), sanitizerEnvironment
			, sanitizerProbes };
	};
};
