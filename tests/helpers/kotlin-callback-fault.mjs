/** @file Exercise fatal callbacks through an installed Kotlin suspend API. */
import assert from "node:assert/strict";
import {mkdir, readFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

/**
 * Compile and run a Kotlin application against relocated Maven dependencies.
 *
 * @param options - Installed classpath, JDK, Kotlin compiler, and scratch directory.
 * @param options.proj - Private application workspace with the restored artifacts.
 * @param options.classpath - Paths resolved by the isolated Maven installation.
 * @param options.env - Producer tool locations, excluded during application execution.
 */
export const exerciseKotlinFault = async ({proj, classpath, env}) => {
	const classes = join(proj, "kotlin-fault");
	await mkdir(classes);
	const observer = resolve("tests/fixtures/jvm-tasks/Observe.java");
	const client = resolve("tests/fixtures/jvm-retained/KotlinTrap.kt");
	const java = env.LEAN_BRIDGE_JAVA, sdk = env.LEAN_BRIDGE_KOTLIN_HOME;
	await run(env.LEAN_BRIDGE_JAVAC, ["--release", "22", "-proc:none", "-d", classes, observer], proj, env);
	const cp = classes + ":" + classpath;
	const compile = ["-XX:ActiveProcessorCount=1", "-Xmx384m", "-cp", join(sdk, "lib/*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"];
	await run(java, [...compile, "-kotlin-home", sdk, "-jdk-home", env.JAVA_HOME, "-no-stdlib", "-no-reflect", "-Werror", "-jvm-target", "22", "-classpath", cp, "-d", classes, client], proj, env);
	const launch = ["-XX:ActiveProcessorCount=1", "-Xmx192m", "-Djava.io.tmpdir=" + proj, "--enable-native-access=ALL-UNNAMED", "-cp", cp, "KotlinTrapKt"];
	const isolated = {PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: proj, LEAN_NUM_THREADS: "1"};
	const observations = [];
	for(const mode of ["active", "after-cancel"]) for(const order of ["feedback-first", "peer-first"])
	{
		const output = await run(java, [...launch, mode, order], proj, isolated, 180_000);
		assert.equal(output, "Kotlin " + mode + " " + order + ": one callback, both packages retired, zero live identities, descriptor delta zero");
		observations.push({mode, order, output});
	}
	return {clientSha256: sha256(await readFile(client)), observerSha256: sha256(await readFile(observer)), observations};
};
