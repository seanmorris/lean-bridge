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
 * @param options - Explicit transport capabilities.
 * @param options.transferredInputs - Enable consuming input leases.
 * @param options.anchoredResults - Preserve original-owner borrowed results.
 * @param options.receiverExports - Lower compiler-authorized receiver sites.
 * @param options.hostCallbacks - Enable callback transport independently.
 */
export const compileOwnedJvmCallNative = async (compiled, { transferredInputs = false, anchoredResults = false, receiverExports = false, hostCallbacks = true } = {}) => {
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks
		, ...receiverExports ? { receiverExports: true } : {}
		, ...transferredInputs ? { transferredInputs: true } : {}
		, ...anchoredResults ? { anchoredResults: true } : {} };
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
	const anchored = model.c.functions.some(fn => fn.anchor !== undefined);
	const family = kotlin ? "Kotlin" : "Java", unit = nodes.get(fn.result).name === "unit";
	if(!kotlin)
	{
		const types = fn.parameters.map((id, i) => anchored ? model.parameterType(fn, i, false) : model.c.hostArgument(fn, i) ? nodes.get(id).delegateType : model.type(id, false));
		return `    static ${anchored ? model.returnType(fn, false) : model.type(fn.result, false)} ${fn.publicName}(${types.map((type, i) => `${type} arg${i}`).join(", ")}) {
        return bindings.callJava${index}(${types.map((_, i) => `arg${i}`).join(", ")});
    }`;
	}
	const types = fn.parameters.map((id, i) => model.c.hostArgument(fn, i)
		? model.namespace + ".kotlin." + nodes.get(id).delegateType : anchored && (fn.anchor === i || fn.transfers?.includes(i)) ? `${model.namespace}.Value<${model.kotlin.publicTypes[id]}>` : model.kotlin.publicTypes[id]);
	const result = anchored && nodes.get(fn.result).representation !== "copied"
		? nodes.get(fn.result).ownerType ? `${model.namespace}._OwnedKotlin${nodes.get(fn.result).ownerType}`
			: `${model.namespace}.Value<${model.kotlin.publicTypes[fn.result]}>` : model.kotlin.publicTypes[fn.result];
	return `    private fun ${fn.publicName}(${types.map((type, i) => `arg${i}: ${type}`).join(", ")}): ${unit ? "kotlin.Unit" : result} {
        ${unit ? "" : "return "}bindings.call${family}${index}(${types.map((_, i) => `arg${i}`).join(", ")})
    }`;
}).concat((model.wholeCopies ?? []).map(copy => kotlin
	? `    private fun ${copy.publicName}(value: ${model.kotlin.publicTypes[copy.id]}): ${model.namespace}.Value<${model.kotlin.publicTypes[copy.id]}> = bindings.${model.methodName(copy.call, "Kotlin")}(value)`
	: `    static ${model.namespace}.Value<${model.type(copy.id, false)}> ${copy.publicName}(${model.type(copy.id, false)} value) { return bindings.${model.methodName(copy.call, "Java")}(value); }`)).join("\n");
