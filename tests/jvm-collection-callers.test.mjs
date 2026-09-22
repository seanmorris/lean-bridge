/**
 * Compile independent Java/Kotlin consumers before building native collections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { jvmCollectionConsumer, jvmCollectionRejections } from "./helpers/jvm-collection-fixture.mjs";
import { captureCorpusCompiler } from "./helpers/type-corpus-compiler.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, jvmDiagnostics } from "./helpers/type-corpus-jvm-tools.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("JVM collection callers compile all exports and reject incorrect public types", { skip: process.env.LEAN_BRIDGE_JVM_COLLECTION_PREFLIGHT !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-collection-callers-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const profiles = (process.env.LEAN_BRIDGE_JVM_COLLECTION_PROFILES ?? "java,kotlin").split(",");
	assert.ok(profiles.length > 0 && new Set(profiles).size === profiles.length);
	assert.ok(profiles.every(profile => ["java", "kotlin"].includes(profile)));
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), sources = [];
	for(const [path, source] of Object.entries(generateCopiedJvmPackage(collectionReviewedIr())).filter(([path]) => path.endsWith(".java")))
	{ await saveLakeFile(root, path, source); sources.push(path); }
	await saveLakeFile(root, "Wire.java", await readFile("tests/fixtures/type-corpus/consumers/Wire.java"));
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources, "Wire.java"], root);
	const kotlin = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), lib = join(kotlin, "lib");
	for(const profile of profiles)
	{
		const java = profile === "java", source = jvmCollectionConsumer(profile), file = `Consumer.${java ? "java" : "kt"}`;
		assert.equal(new Set([...source.matchAll(/Api(?:\.(\w+)\(|::(\w+))/g)].map(match => match[1] ?? match[2])).size, 35);
		assert.doesNotMatch(source, /MemorySegment|MethodHandles|ValueLayout|setAccessible/);
		await saveLakeFile(root, file, source);
		const compiler = java ? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_JAVA;
		const args = java ? [...javaCompilerOptions, "-cp", "classes", "-d", "java-consumer"]
			: [
				"-cp", join(lib, "*")
				, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
				, ...kotlinCompilerOptions
				, "-jdk-home"
				, dirname(dirname(environment.LEAN_BRIDGE_JAVA))
				, "-cp"
				, `classes:${join(lib, "kotlin-stdlib.jar")}:${join(lib, "annotations-13.0.jar")}`
				, "-d"
				, "kotlin-consumer"];
		await runCopied(compiler, [...args, file], root);
		for(const entry of jvmCollectionRejections(profile))
		{
			const invalid = `reject-${entry.id.split("/")[1]}.${java ? "java" : "kt"}`;
			await saveLakeFile(root, invalid, entry.source);
			const result = await captureCorpusCompiler(compiler, [...args, ...java ? ["-XDrawDiagnostics"] : [], invalid], root, copiedCleanEnvironment);
			jvmDiagnostics(result, entry, profile, root, invalid);
		}
		t.diagnostic(`${profile}: all 35 exports compile; eight invalid consumers reject at their source`);
	}
});
