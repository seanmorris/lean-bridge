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
import { generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { compileJvmSources } from "../src/build/compile-jvm-sources.mjs";
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
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), files = generateCopiedJvmKotlinPackage(collectionReviewedIr());
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await compileJvmSources({ root, files, environment });
	await saveLakeFile(root, "Wire.java", await readFile("tests/fixtures/type-corpus/consumers/Wire.java"));
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", "Wire.java"], root);
	const kotlin = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), lib = join(kotlin, "lib");
	for(const profile of profiles)
	{
		const java = profile === "java", source = jvmCollectionConsumer(profile), file = `Consumer.${java ? "java" : "kt"}`;
		assert.equal(new Set([...source.matchAll(/Api(?:\.(\w+)\(|::(\w+))/g)].map(match => match[1] ?? match[2]).filter(name => name !== "class")).size, 35);
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

test("Kotlin keyword fields and annotation-named records compile without exposing the erased bridge", { skip: process.env.LEAN_BRIDGE_JVM_COLLECTION_PREFLIGHT !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-kotlin-names-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = collectionReviewedIr(), environment = nativeFixtureEnvironment(["java", "kotlin"]);
	for(const [before, after] of [["Single", "JvmField"], ["Count", "Suppress"], ["Empty", "JvmStatic"]])
		ir.types.find(type => type.name === before).name = after;
	ir.types.find(type => type.name === "Pair").fields[0].name = "when";
	const files = generateCopiedJvmKotlinPackage(ir);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	await compileJvmSources({ root, files, environment });
	const kotlin = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), lib = join(kotlin, "lib");
	const args = [
		"-cp", join(lib, "*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler"
		, ...kotlinCompilerOptions, "-jdk-home"
		, dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, "-cp", `classes:${join(lib, "kotlin-stdlib.jar")}`, "-d", "consumer"];
	await saveLakeFile(root, "Consumer.kt", `import org.leanbridge.collections.kotlin.Api
import org.leanbridge.collections.kotlin.JvmField
import org.leanbridge.collections.kotlin.Suppress
import org.leanbridge.collections.kotlin.JvmStatic
import java.math.BigInteger
fun calls() {
    val first: BigInteger = Api.recordSingle(JvmField(BigInteger.ONE)).value
    val second: BigInteger = Api.recordCount(Suppress(BigInteger.ONE)).value
    val empty: JvmStatic = Api.recordEmpty(JvmStatic())
    val keyword: Long = Api.recordMake().\`when\`
    check(first == second && empty == JvmStatic() && keyword == 42L)
}
`);
	await runCopied(environment.LEAN_BRIDGE_JAVA, [...args, "Consumer.kt"], root);
	const source = "fun rejected() { org.leanbridge.collections.KotlinCalls.call0(null) }\n";
	await saveLakeFile(root, "Invalid.kt", source);
	const result = await captureCorpusCompiler(environment.LEAN_BRIDGE_JAVA, [...args, "Invalid.kt"], root, copiedCleanEnvironment);
	const entry = { id: "kotlin/private-erased-bridge", expectation: { diagnostic: "INVISIBLE_REFERENCE" } };
	jvmDiagnostics(result, entry, "kotlin", root, "Invalid.kt");
	const java = "class Invalid { void rejected() { org.leanbridge.collections.KotlinCalls.INSTANCE.call0(null); } }\n";
	await saveLakeFile(root, "Invalid.java", java);
	const rejected = await captureCorpusCompiler(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", `classes:${join(lib, "kotlin-stdlib.jar")}`, "-XDrawDiagnostics", "Invalid.java"], root, copiedCleanEnvironment);
	jvmDiagnostics(rejected, { id: "kotlin/synthetic-erased-bridge", expectation: { diagnostic: "compiler.err.cant.resolve.location.args" } }, "java", root, "Invalid.java");
});
