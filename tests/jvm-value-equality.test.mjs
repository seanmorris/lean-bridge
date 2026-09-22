/**
 * Compile and execute public Java and Kotlin value semantics without Lean libraries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";

test("generated JVM values compare and hash nested payloads from Java and Kotlin without Lean", { skip: process.env.LEAN_BRIDGE_JVM_EQUALITY_TEST !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-value-equality-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sourceHashes = {}, sources = [];
	for(const fixture of [collectionReviewedIr, compoundReviewedIr, listReviewedIr, nativeAliasReviewedIr, nativeVariantReviewedIr])
		for(const [path, source] of Object.entries(generateCopiedJvmPackage(fixture())).filter(([path]) => path.endsWith(".java")))
		{ await saveLakeFile(root, path, source); sources.push(path); sourceHashes[path] = sha256(source); }
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const javaSource = await readFile("tests/fixtures/collection-consumers/jvm-equality.java", "utf8");
	const kotlinSource = await readFile("tests/fixtures/collection-consumers/jvm-equality.kt", "utf8");
	await saveLakeFile(root, "Equality.java", javaSource);
	await saveLakeFile(root, "Equality.kt", kotlinSource);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources, "Equality.java"], root);
	const kotlin = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), stdlib = join(kotlin, "lib/kotlin-stdlib.jar");
	const compiler = join(kotlin, "lib/kotlin-compiler.jar");
	await runCopied(environment.LEAN_BRIDGE_JAVA, [
		"-cp", compiler
		, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
		, ...kotlinCompilerOptions
		, "-jdk-home"
		, dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, "-cp"
		, `classes:${stdlib}`
		, "Equality.kt"
		, "-d"
		, "kotlin-classes"], root);
	const observations = {};
	for(const [profile, main, classpath] of [["java", "Equality", "classes"], ["kotlin", "EqualityKt", `classes:kotlin-classes:${stdlib}`]])
	{
		const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ["-cp", classpath, main], root, copiedCleanEnvironment);
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.ok(observation.checks > 2000); assert.equal(observation.generatedProfiles, 5);
		assert.equal(observation.fixedArrayDepth, 24); assert.equal(observation.nativeCalls, 0);
		observations[profile] = observation;
		t.diagnostic(`${profile}: ${observation.checks} public equality/hash checks across five projections, no native library loaded`);
	}
	await saveLakeFile("build/equality", "jvm.json", canonicalJson({ schemaVersion: 1
		, kind: "jvm-value-equality-preflight"
		, compiledLean: false
		, installedPackage: false
		, generatedSourceHashes: sourceHashes
		, consumerHashes: { java: sha256(javaSource), kotlin: sha256(kotlinSource) }
		, observations }));
});
