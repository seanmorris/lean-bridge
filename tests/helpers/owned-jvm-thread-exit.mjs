/**
 * Force the native TLS cleanup ordering without relying on a scheduling delay.
 * These gates instrument generated test probes, never the shipped adapter.
 *
 * @file
 */
import { join } from "node:path";
import { compileOwnedJvmCallNative, ownedJvmCallProbeMethods } from "./owned-jvm-call-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const ownedJvmThreadExitWait = "awaitExit(expectedExits, threadAllocations, threadOwners);";

/**
 * Require an exact, unique instrumentation site.
 *
 * @param source - Complete generated test source.
 * @param before - Unique literal site.
 * @param after - Replacement text.
 */
const replaceOnce = (source, before, after) => {
	if(source.split(before).length !== 2) throw new TypeError("Missing or ambiguous JVM thread-exit probe site: " + before);
	return source.replace(before, () => after);
};

/**
 * Hold the actual TLS destructor until the Java probe explicitly releases it.
 *
 * @param source - Existing checked native thread-exit probe.
 */
export const ownedJvmThreadExitGuard = source => `#include <condition_variable>
#include <mutex>
#include <atomic>
#include <cstddef>
static std::mutex cleanup_mutex;
static std::condition_variable cleanup_ready;
static bool hold_cleanup = false;
static std::atomic<size_t> cleanup_entered{0}, cleanup_releases{0};
extern "C" void probe_hold_exit(void) {
  std::lock_guard<std::mutex> lock(cleanup_mutex);
  hold_cleanup = true;
}
extern "C" void probe_release_exit(void) {
  std::lock_guard<std::mutex> lock(cleanup_mutex);
  if (hold_cleanup) { hold_cleanup = false; ++cleanup_releases; }
  cleanup_ready.notify_all();
}
extern "C" size_t probe_entered_exits(void) { return cleanup_entered.load(); }
extern "C" size_t probe_exit_releases(void) { return cleanup_releases.load(); }
` + replaceOnce(source, "~OwnedJvmThreadExit() noexcept {", `~OwnedJvmThreadExit() noexcept {
    {
      std::unique_lock<std::mutex> lock(cleanup_mutex);
      ++cleanup_entered;
      cleanup_ready.wait(lock, [] { return !hold_cleanup; });
    }`);

/**
 * Remove only the repaired synchronization call for the negative control.
 *
 * @param source - Generated Java caller, including its real signature exercise.
 */
export const withoutOwnedJvmThreadExitWait = source => replaceOnce(source, ownedJvmThreadExitWait, "/* negative control: native cleanup is not awaited */");

/**
 * Instrument the public Java/Kotlin signature exercise and its fault harness.
 * The mutant releases native cleanup after recording the allocation baseline.
 * The repaired exercise releases and awaits cleanup before that baseline.
 *
 * @param model - Actual generated public calls and value types.
 * @param template - Authored Java fault-injection harness.
 * @param exercise - Authored Java signature exercise.
 * @param kotlin - Authored Kotlin signature exercise.
 */
export const ownedJvmThreadExitSources = (model, template, exercise, kotlin) => {
	const files = { ...model.files }, runtime = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
	files[runtime] = replaceOnce(files[runtime], "static void checkpoint() { }", "static void checkpoint() { OwnedCallProbe.allocation(); }");
	let probe = replaceOnce(template, "/* METHODS */", ownedJvmCallProbeMethods(model));
	probe = replaceOnce(probe, "/* EXERCISE */", exercise);
	probe = replaceOnce(probe, "private static MethodHandle live, identities, fail, exits, exitErrors, retired;", `private static MethodHandle live, identities, fail, exits, exitErrors, retired;
    private static MethodHandle holdExit, releaseExit, enteredExits, exitReleases;
    private static void gate(MethodHandle action) {
        try { action.invokeExact(); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private static void awaitNativeCount(MethodHandle counter, long expected, String message) {
        for (int index = 0; index < 2000 && count(counter) < expected; index++) {
            try { Thread.sleep(5); } catch (InterruptedException error) { throw new AssertionError(error); }
        }
        if (count(counter) != expected) throw new AssertionError(message);
    }
    private static void awaitHeldExit() {
        try {
            awaitNativeCount(enteredExits, 1, "native TLS destructor did not enter the gate");
            if (count(exits) != 0 || count(exitReleases) != 0)
                throw new AssertionError("native TLS destructor escaped its closed gate");
        } catch (Throwable error) { gate(releaseExit); throw _OwnedRuntime.rethrow(error); }
    }
    private static void releaseAfterBaseline() {
        long entered = count(enteredExits);
        if (entered > count(exits)) {
            gate(releaseExit);
            awaitNativeCount(exits, entered, "native TLS destructor did not leave its gate");
            if (count(exitErrors) != 0) throw new AssertionError("native TLS cleanup failed");
        }
    }`);
	probe = replaceOnce(probe, "var thread = new Thread(() -> { try { kept[0].invoke(input); }", "gate(holdExit);\n            var thread = new Thread(() -> { try { kept[0].invoke(input); }");
	probe = replaceOnce(probe, "thread.start(); try { thread.join(); } catch (InterruptedException error) { throw new AssertionError(error); }", `thread.start();
            try {
                thread.join(10000);
                if (thread.isAlive()) throw new AssertionError("Java thread did not finish while native cleanup was held");
            } catch (Throwable error) { gate(releaseExit); throw _OwnedRuntime.rethrow(error); }
            awaitHeldExit();`);
	probe = replaceOnce(probe, "private static void awaitExit(long expected, long allocations, long owners) {", "private static void awaitExit(long expected, long allocations, long owners) {\n        gate(releaseExit);");
	probe = replaceOnce(probe, "bindings.runtime.current().require(); long allocations = count(live), resources = count(identities);", "bindings.runtime.current().require(); long allocations = count(live), resources = count(identities);\n        releaseAfterBaseline();");
	probe = replaceOnce(probe, "var linker = Linker.nativeLinker();", `var linker = Linker.nativeLinker();
            holdExit = linker.downcallHandle(symbols.find("probe_hold_exit").orElseThrow(), FunctionDescriptor.ofVoid());
            releaseExit = linker.downcallHandle(symbols.find("probe_release_exit").orElseThrow(), FunctionDescriptor.ofVoid());
            enteredExits = linker.downcallHandle(symbols.find("probe_entered_exits").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            exitReleases = linker.downcallHandle(symbols.find("probe_exit_releases").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));`);
	probe = replaceOnce(probe, 'count(exitErrors) + "}");', String.raw`count(exitErrors) + ",\"heldExits\":" + count(enteredExits) + ",\"releasedExits\":" + count(exitReleases) + "}");`);
	files["OwnedCallProbe.java"] = probe;
	files["KotlinCallProbe.kt"] = replaceOnce(kotlin, "/* METHODS */", ownedJvmCallProbeMethods(model, true));
	return { files, runtime };
};

/**
 * Compile the real adapter, then relink its test-only TLS guard with the gate.
 *
 * @param compiled - Fresh compiler output and typed callback carriers.
 */
export const compileOwnedJvmThreadExitNative = async compiled => {
	const native = await compileOwnedJvmCallNative(compiled);
	const guardSource = ownedJvmThreadExitGuard(native.cleanup.guardSource);
	await saveLakeFile(compiled.directory, "guard.cpp", guardSource);
	const env = { PATH: "/usr/bin:/bin" };
	await runCopied("/usr/bin/c++", ["-std=c++17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", "-I", join(compiled.directory, "runtime/include"), "-c", "guard.cpp", "-o", "guard.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", [
		"-shared", "-pthread", "api.o", "guard.o", "Owned.o", "Carriers.o"
		, "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-lgmp", "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-Wl,-z,defs", "-Wl,-z,nodelete", "-o", "libprobe.so"
	], compiled.directory, env);
	return { ...native, cleanup: { ...native.cleanup, guardSource } };
};
