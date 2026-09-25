/**
 * Typed JVM compounds, independently checked C layouts and compiled Java sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { generateJvmBindingPackage } from "../src/backends/jvm/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { jvmCompoundConsumer, jvmCompoundPublicChecks, jvmCompoundRejections } from "./helpers/jvm-compound-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { javaCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";
import { assertJvmHistoricalSource, readJvmHistoricalEvidence } from "./helpers/jvm-source-history.mjs";

test("JVM compounds preserve typed branches, boxed payloads and binary products", () => {
	const ir = compoundReviewedIr(), model = compileCopiedJvmModel(ir), files = generateCopiedJvmPackage(ir);
	assert.equal(model.surface.functions.length, 64);
	assert.deepEqual(files, generateCopiedJvmPackage(structuredClone(ir)));
	assert.deepEqual(generateCopiedJvmKotlinPackage(ir), generateJvmBindingPackage(ir));
	auditManagedBindingPackage(ir, files, "jvm");
	const root = "src/main/java/org/leanbridge/compounds/", api = files[`${root}Api.java`];
	assert.match(api, /long classify\(Option<Option<Unit>>/);
	assert.match(api, /Result<Option<String>, Pair<Long, Option<Unit>>> flip\(Result<Pair<Long, Option<Unit>>, Option<String>>/);
	for(const path of JSON.parse(files["binding-manifest.json"]).publicFiles) assert.doesNotMatch(files[path], /MemorySegment|MethodHandle|java\.lang\.foreign/);
	assert.match(files[`${root}Option.java`], /sealed interface Option<T>/);
	assert.match(files[`${root}Result.java`], /sealed interface Result<T, E>/);
	assert.match(files[`${root}Pair.java`], /record Pair<A, B>/);
	const copy = field => model.surface.copy(model.surface.functions.find(fn => fn.field === field).declaration.result.type);
	for(const [field, size, offsets] of [["option_unit", 2, [1]], ["option_uint64", 16, [8]], ["option_string", 40, [8]], ["result_string", 72, [8, 40]], ["tuple_string", 64, [0, 32]]])
	{
		assert.equal(copy(field).size, size, field); assert.deepEqual(copy(field).fields.map(field => field.offset), offsets);
	}
	assert.match(files[`${root}Runtime.java`], /Invalid native Option flag/);
	assert.match(files[`${root}Runtime.java`], /Invalid native Except flag/);
	assert.match(files[`${root}Runtime.java`], /java\.lang\.reflect\.Array\.newInstance\(Option\.class, count\)/);
});

for(const name of ["Option", "Result", "Pair"]) test(`JVM compound ${name} cannot collide with a record`, () => {
	const ir = compoundReviewedIr(); ir.types.find(type => type.kind === "record").name = name;
	assert.throws(() => compileCopiedJvmModel(ir), /record name collides/);
});

test("JVM compounds admit copied callables but reject borrowed copied identity", () => {
	const ir = callableReviewedIr();
	ir.types[0].callable.result.type = { kind: "apply", constructor: "option", arguments: [{ kind: "primitive", name: "unit" }] };
	assert.doesNotThrow(() => compileCopiedJvmModel(ir));
	const borrowed = compoundReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedJvmModel(borrowed), /copy ownership/);
});

test("JVM compound evidence binds both languages to prepared packages and runtime-only execution", async () => {
	const record = await readJvmHistoricalEvidence("jvm-compounds-20260920");
	assert.equal(record.wordBits, 64); assert.equal(record.jdk, "22.0.2"); assert.equal(record.kotlin, "2.2.0");
	assert.deepEqual(record.signatures, compoundSignatures);
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertJvmHistoricalSource("jvm-compounds-20260920", path, hash);
	for(const run of record.executions)
	{
		assert.equal(run.checks, 36872);
		assert.equal(record.consumerHashes[run.profile], sha256(jvmCompoundConsumer(run.profile)));
		assert.equal(run.jvm.consumerSourceSha256, record.consumerHashes[run.profile]);
		assert.equal(run.jvm.signaturesSha256, sha256(jvmCompoundPublicChecks(run.profile)));
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "observationSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly", "exactPublicSignatures"]) assert.equal(run.jvm[key], true, key);
		assert.deepEqual(run.jvm.runtimeModules, ["java.base@22.0.2"]);
		assert.equal(run.jvm.deployment["package.jar"].sha256, run.jvm.archiveSha256);
		const shared = record.executions.find(other => other.path === run.path && other.profile !== run.profile);
		assert.deepEqual(run.packages, shared.packages);
		assert.equal(run.jvm.archiveSha256, shared.jvm.archiveSha256);
		assert.equal(run.faultProbe, run.path);
		const expected = jvmCompoundRejections(run.profile);
		assert.deepEqual(run.rejected.map(result => result.id), expected.map(result => result.id));
		for(const [i, result] of run.rejected.entries())
		{
			assert.equal(result.sourceSha256, sha256(expected[i].source));
			assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [expected[i].expectation.diagnostic].flat());
		}
	}
	assert.deepEqual(Object.keys(record.faultProbes), ["ordinary-source", "reviewed-ir"]);
	for(const probe of Object.values(record.faultProbes))
	{
		assert.equal(probe.checks, 140); assert.equal(probe.flagChecks, 9); assert.equal(probe.partialInputChecks, 16);
		assert.equal(probe.isolatedInstrumentedProjection, true); assert.equal(probe.releaseJarUnchanged, true); assert.equal(probe.normalExitCleanup, true);
		assert.deepEqual(Object.keys(probe.originalSources), Object.keys(probe.instrumentedSources).filter(path => !/\/(?:CompoundProbe|Faults)\.java$/.test(path)));
		for(const [path, hash] of Object.entries(probe.originalSources))
			if(!/\/(?:Runtime|Scope)\.java$/.test(path)) assert.equal(probe.instrumentedSources[path], hash, path);
	}
});

const environment = nativeFixtureEnvironment(["java", "kotlin"]);
test("all generated JVM compound sources compile with warnings treated as errors", { skip: !existsSync(environment.LEAN_BRIDGE_JAVAC) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-compound-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedJvmPackage(compoundReviewedIr()), sources = Object.keys(files).filter(path => path.endsWith(".java"));
	for(const path of sources) await saveLakeFile(root, path, files[path]);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources], root);
});
