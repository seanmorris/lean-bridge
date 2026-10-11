/**
 * Compile independent Java and Kotlin callers against genuine generated public types.
 * This source-only gate does not execute Lean or claim installed acceptance.
 *
 * @file
 */
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { generateCopiedJvmKotlinPackage } from "../../src/backends/jvm/copied-kotlin.mjs";
import { compileJvmSources } from "../../src/build/compile-jvm-sources.mjs";
import { structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeJvmCaller } from "./structural-subtype-jvm-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("independent structural Java and Kotlin callers compile against both generated APIs", {
	skip: process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_JVM_CALLER_TEST !== "1"
	, timeout: 300_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-jvm-callers-"));
	t.after(() => rm(root, { recursive: true }));
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const files = generateCopiedJvmKotlinPackage(structuralSubtypeReview());
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await compileJvmSources({ root, files, environment });
	for(const profile of ["java", "kotlin"])
		await saveLakeFile(root, profile === "java" ? "consumer.java" : "consumer.kt", await structuralSubtypeJvmCaller(profile, "ordinary"));
	await mkdir(join(root, "java-caller"));
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-proc:none", "-cp", "classes", "-d", "java-caller", "consumer.java"], root);
	await runCopied(environment.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", "classes", "consumer.kt", "-include-runtime", "-d", "consumer.jar"]
		, root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) });
});
