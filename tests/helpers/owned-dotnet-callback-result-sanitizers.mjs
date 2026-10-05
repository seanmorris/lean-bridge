/**
 * Instrument the native adapter actually invoked by the managed consumer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const ownedDotnetSanitizerControls = `#include <stddef.h>
#include <stdlib.h>
void probe_address(size_t index) {
  volatile char *value = malloc(1); value[index] = 1; free((void *)value);
}
int probe_undefined(int shift) { volatile int value = 1; return value << shift; }
`;

/**
 * Run identical C# calls against ASan/UBSan-native code and positive controls.
 *
 * @param compiled - Fresh Lean component with the generated C# executable.
 * @param hostCallbacks - Link actual compiler-generated host callback carriers.
 * @param expected - Exact unsanitized runtime observation.
 */
export const runOwnedDotnetCallbackSanitizers = async (compiled, hostCallbacks, expected) => {
	const environment = { PATH: "/usr/bin:/bin" };
	const flags = ["-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC"
		, "-fsanitize=address,undefined", "-fno-omit-frame-pointer"
		, "-I", join(compiled.directory, "runtime/include") ];
	await saveLakeFile(compiled.directory, "sanitizer-controls.c", ownedDotnetSanitizerControls);
	for(const [compiler, language, source, output] of [
		["/usr/bin/cc", "c11", "api.c", "sanitized-api.o"]
		, ["/usr/bin/c++", "c++17", "guard.cpp", "sanitized-guard.o"]
		, ["/usr/bin/cc", "c11", "sanitizer-controls.c", "sanitized-controls.o"]
	]) await runCopied(compiler, ["-std=" + language, ...flags, "-c", source, "-o", output], compiled.directory, environment);
	await runCopied("/usr/bin/c++", ["-shared", "-pthread"
		, "-fsanitize=address,undefined"
		, "sanitized-api.o", "sanitized-guard.o", "sanitized-controls.o"
		, "Owned.o", "Carriers.o", "Witness.o"
		, ...hostCallbacks ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-lgmp", "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-Wl,-z,defs", "-Wl,-z,nodelete", "-o", "libsanitized.so"]
	, compiled.directory, environment);
	const libraries = [];
	for(const name of ["libasan.so", "libubsan.so"])
	{
		const path = (await runCopied("/usr/bin/cc", ["-print-file-name=" + name], compiled.directory, environment)).stdout.trim();
		assert.ok(path.startsWith("/")); libraries.push(path);
	}
	const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const env = { ...environment, DOTNET_ROOT: dirname(dotnet)
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, LD_PRELOAD: libraries.join(":")
		// Native leak ownership is checked by the allocation and identity ledgers.
		// This run instruments address/undefined behavior, not the CLR allocator.
		, ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1:intercept_tls_get_addr=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" };
	const run = (mode, extra = {}) => runCopied("/bin/sh", [
		"-c", 'ulimit -c 0\nexec "$@"'
		, "dotnet-callback-sanitizers", dotnet, "out/Calls.dll"
		, join(compiled.directory, "libsanitized.so"), mode]
	, compiled.directory, { ...env, ...extra });
	const exercised = await run("callbacks");
	assert.equal(exercised.stderr, ""); assert.deepEqual(JSON.parse(exercised.stdout), expected);
	const rejected = [];
	for(const [fault, diagnostic] of [
		["address", /ERROR: AddressSanitizer: heap-buffer-overflow/u]
		, ["undefined", /runtime error: shift exponent 40 is too large/u]
	]) {
		await assert.rejects(run(fault, fault === "address" ? { UBSAN_OPTIONS: "halt_on_error=0" } : {}), error => {
			assert.match(error.details?.stderr ?? "", diagnostic);
			assert.doesNotMatch(error.details?.stdout ?? "", /"checks":/u);
			return true;
		});
		rejected.push({ fault, diagnostic: diagnostic.source, rejected: true });
	}
	return { nativeSanitizers: ["address", "undefined"], leakSanitizer: false
		, nativeLeakChecks: "allocation-and-identity-ledgers"
		, environment: env, observation: JSON.parse(exercised.stdout), rejected };
};
