/**
 * Instrument the C adapter and thread guard used by actual JVM consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const ownedJvmCallbackSanitizerControls = `#include <stddef.h>
#include <stdlib.h>
void probe_address(size_t index) {
  volatile char *value = malloc(1); value[index] = 1; free((void *)value);
}
int probe_undefined(int shift) { volatile int value = 1; return value << shift; }
`;

/**
 * Compile sanitizer instrumentation independently from the unsanitized adapter.
 *
 * @param compiled - Actual Lean fixture and saved generated C/C++ sources.
 * @param hostCallbacks - Whether compiler-generated upcall carriers are linked.
 */
export const compileOwnedJvmCallbackSanitizers = async (compiled, hostCallbacks) => {
	const environment = { PATH: "/usr/bin:/bin" };
	const flags = ["-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC"
		, "-fsanitize=address,undefined", "-fno-omit-frame-pointer"
		, "-I", join(compiled.directory, "runtime/include")];
	await saveLakeFile(compiled.directory, "sanitizer-controls.c", ownedJvmCallbackSanitizerControls);
	for(const [compiler, language, source, object] of [
		["/usr/bin/cc", "c11", "api.c", "sanitized-api.o"]
		, ["/usr/bin/c++", "c++17", "guard.cpp", "sanitized-guard.o"]
		, ["/usr/bin/cc", "c11", "sanitizer-controls.c", "sanitized-controls.o"]
	]) await runCopied(compiler, ["-std=" + language, ...flags, "-c", source, "-o", object], compiled.directory, environment);
	await runCopied("/usr/bin/c++", [
		"-shared", "-pthread", "-fsanitize=address,undefined"
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
	return { ...environment, LD_PRELOAD: libraries.join(":")
		// HotSpot handles its own guarded-memory signals. Native ownership has
		// separate allocation/identity ledgers; the JVM itself is not instrumented.
		, ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1:intercept_tls_get_addr=0:handle_segv=0:use_sigaltstack=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" };
};

/**
 * Drive public Java/Kotlin calls, close their runtime and observe native counters.
 *
 * @param namespace - Compiler-derived JVM namespace.
 */
export const ownedJvmCallbackSanitizerDriver = namespace => `package ${namespace};
import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import static java.lang.foreign.ValueLayout.*;
public final class CallbackSanitizerProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities;
    public static void done(int checks) {
      try {
        bindings.runtime.current().close();
        long allocations = (long)live.invokeExact(), owners = (long)identities.invokeExact();
        if (allocations != 0 || owners != 0) throw new AssertionError("native owners remain");
        System.out.println("{\\"checks\\":" + checks + ",\\"live\\":" + allocations + ",\\"identities\\":" + owners + "}");
      } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    public static void main(String[] args) throws Throwable {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library);
            var linker = Linker.nativeLinker();
            if (args[1].equals("address")) {
                linker.downcallHandle(symbols.find("probe_address").orElseThrow(), FunctionDescriptor.ofVoid(JAVA_LONG)).invokeExact(8L);
                throw new AssertionError("AddressSanitizer missed its positive control");
            }
            if (args[1].equals("undefined")) {
                int result = (int)linker.downcallHandle(symbols.find("probe_undefined").orElseThrow(), FunctionDescriptor.of(JAVA_INT, JAVA_INT)).invokeExact(40);
                throw new AssertionError("UBSan missed its positive control: " + result);
            }
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            Class.forName(args[1].equals("java") ? "Consumer" : "ConsumerKt")
                .getMethod("main", String[].class).invoke(null, (Object)new String[0]);
        }
    }
}
`;
