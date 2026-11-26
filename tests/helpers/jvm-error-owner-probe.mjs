/** @file Check the last live lease of a declared synchronous error on installed Maven components. */
import assert from "node:assert/strict";
import {mkdir, readFile} from "node:fs/promises";
import {basename, delimiter, join, resolve} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

/**
 * Compile separate Java and Kotlin applications and run the ownership checks.
 *
 * @param options - Verified, relocated package classpath and configured JDK tools.
 */
export const exerciseJvmErrorOwner = async options => {
	const {proj, classpath, env} = options, classes = join(proj, "error-owner");
	await mkdir(classes);
	const root = resolve("tests/fixtures/jvm-sync-resources");
	const files = [resolve("tests/fixtures/jvm-tasks/Observe.java"), join(root, "ErrorOwner.java"), join(root, "KotlinErrorOwner.kt")];
	const java = env.LEAN_BRIDGE_JAVA, sdk = env.LEAN_BRIDGE_KOTLIN_HOME;
	await run(env.LEAN_BRIDGE_JAVAC, ["-J-XX:ActiveProcessorCount=1", "--release", "22", "-proc:none", "-cp", classpath, "-d", classes, ...files.slice(0, 2)], proj, env);
	const cp = classes + delimiter + classpath;
	const compile = ["-XX:ActiveProcessorCount=1", "-Xmx384m", "-cp", join(sdk, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"];
	await run(java, [...compile, "-kotlin-home", sdk, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect", "-Werror", "-jvm-target", "22", "-classpath", cp, "-d", classes, files[2]], proj, env);
	const launch = ["-XX:ActiveProcessorCount=1", "-Xmx192m", "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED", "-cp", cp];
	const clean = {PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: proj, LEAN_NUM_THREADS: "1"};
	const observations = [];
	for(const [main, language] of [["ErrorOwner", "Java"], ["KotlinErrorOwnerKt", "Kotlin"]]) for(const order of ["desk-first", "peer-first"])
	{
		const observed = await run(java, [...launch, main, order], proj, clean);
		assert.equal(observed, language + ": only the declared error holds the live ticket, peer read 42, zero owners and descriptor delta");
		observations.push({language, order, observed});
	}
	const sources = {};
	for(const file of files) sources[basename(file)] = sha256(await readFile(file));
	return {sources, observations};
};
