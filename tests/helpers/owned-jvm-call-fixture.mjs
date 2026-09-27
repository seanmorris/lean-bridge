/**
 * Compile the actual native adapter and both JVM language families.
 *
 * @file
 */
import { dirname, join } from "node:path";
import { ownedJvmConversionNative } from "./owned-jvm-conversion-native.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./type-corpus-jvm-tools.mjs";

/**
 * Observe native thread destruction independently of Java Thread.join().
 *
 * @param input - Actual compiler metadata and source identity.
 */
export const ownedJvmCallNative = input => {
	const generated = ownedJvmConversionNative(input), { cleanup, c } = generated;
	const destructor = `~OwnedJvmThreadExit() noexcept { (void)${c.values.prefix}_jvm_thread_cleanup(); }`;
	if(cleanup.guardSource.split(destructor).length !== 2) throw new TypeError("Missing owned JVM thread destructor");
	const guardSource = `#include <atomic>
#include <cstddef>
static std::atomic<size_t> exits{0}, exit_errors{0};
extern "C" size_t probe_exits(void) { return exits.load(); }
extern "C" size_t probe_exit_errors(void) { return exit_errors.load(); }
` + cleanup.guardSource.replace(destructor, `~OwnedJvmThreadExit() noexcept {
    if (${c.values.prefix}_jvm_thread_cleanup() != 0) ++exit_errors;
    ++exits;
  }`);
	return { ...generated, cleanup: { ...cleanup, guardSource } };
};

/**
 * Build the checked C adapter and creator-thread cleanup.
 *
 * @param compiled - Actual Lean fixture with callback carriers.
 */
export const compileOwnedJvmCallNative = async compiled => {
	const input = { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component, hostCallbacks: true };
	const generated = ownedJvmCallNative(input), { c, cleanup, implementation } = generated;
	for(const [path, source] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await saveLakeFile(compiled.directory, "guard.cpp", cleanup.guardSource);
	const env = { PATH: "/usr/bin:/bin" }, includes = ["-I", join(compiled.directory, "runtime/include")];
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "api.c", "-o", "api.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", ["-std=c++17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "guard.cpp", "-o", "guard.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", [
		"-shared", "-pthread", "api.o", "guard.o"
		, "Owned.o", "Carriers.o", "Witness.o"
		, ...compiled.callbackSource ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-lgmp", "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-Wl,-z,defs", "-Wl,-z,nodelete", "-o", "libprobe.so"
	], compiled.directory, env);
	return { input, ...generated };
};

/**
 * Compile Kotlin metadata, then Java, with the real pinned toolchain.
 *
 * @param root - Owned temporary test directory.
 * @param files - Complete generated sources and independent callers.
 */
export const compileOwnedJvmCallSources = async (root, files) => {
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const home = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), stdlib = join(home, "lib/kotlin-stdlib.jar");
	const java = Object.keys(files).filter(path => path.endsWith(".java")), kotlin = Object.keys(files).filter(path => path.endsWith(".kt"));
	await runCopied(environment.LEAN_BRIDGE_JAVA, [
		"-cp", join(home, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
		, "-kotlin-home", home
		, ...kotlinCompilerOptions, "-module-name", "lean_bridge_owned_calls"
		, "-Xuse-type-table"
		, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, "-cp", stdlib + ":" + join(home, "lib/annotations-13.0.jar")
		, "-d", "classes", ...kotlin, ...java
	], root);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", "classes:" + stdlib, "-d", "classes", ...java], root);
	return { java: environment.LEAN_BRIDGE_JAVA, stdlib };
};

/**
 * Independent friendly names over generated private binding methods.
 *
 * @param model - Generated native calls.
 * @param kotlin - Select Kotlin consumer syntax and value family.
 */
export const ownedJvmCallProbeMethods = (model, kotlin = false) => model.functions.map((fn, index) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const family = kotlin ? "Kotlin" : "Java", unit = nodes.get(fn.result).name === "unit";
	if(!kotlin)
	{
		const types = fn.parameters.map((id, i) => model.c.hostArgument(fn, i) ? nodes.get(id).delegateType : model.type(id, false));
		return `    static ${model.type(fn.result, false)} ${fn.publicName}(${types.map((type, i) => `${type} arg${i}`).join(", ")}) {
        return bindings.callJava${index}(${types.map((_, i) => `arg${i}`).join(", ")});
    }`;
	}
	const types = fn.parameters.map((id, i) => model.c.hostArgument(fn, i)
		? model.namespace + ".kotlin." + nodes.get(id).delegateType : model.kotlin.publicTypes[id]);
	return `    private fun ${fn.publicName}(${types.map((type, i) => `arg${i}: ${type}`).join(", ")}): ${unit ? "kotlin.Unit" : model.kotlin.publicTypes[fn.result]} {
        ${unit ? "" : "return "}bindings.call${family}${index}(${types.map((_, i) => `arg${i}`).join(", ")})
    }`;
}).join("\n");
