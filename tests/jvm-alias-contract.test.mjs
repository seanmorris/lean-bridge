/**
 * JVM alias target mappings, source documentation and compiler-checked consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { jvmAliasCatalogDocs } from "../src/backends/jvm/copied-aliases.mjs";
import { generateJvmBindingPackage } from "../src/backends/jvm/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { aliasPrimitives, nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { jvmAliasConsumer, jvmAliasPublicChecks, jvmAliasRejections } from "./helpers/jvm-alias-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { javaCompilerOptions, kotlinCompilerOptions } from "./helpers/type-corpus-jvm-tools.mjs";

const prefix = "src/main/java/org/leanbridge/aliases/";
test("JVM alias evidence binds both installed source paths to named contracts and runtime-only deployments", async () => {
	const record = JSON.parse(await readFile("docs/evidence/jvm-aliases-20260921.json"));
	assert.equal(record.wordBits, 64); assert.equal(record.jdk, "22.0.2"); assert.equal(record.kotlin, "2.2.0");
	assert.deepEqual(record.primitives, aliasPrimitives); assert.deepEqual(record.signatures, nativeAliasSignatures);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeAliasReviewedIr())));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const run of record.executions)
	{
		assert.equal(run.checks, 3711);
		assert.equal(record.consumerHashes[run.profile], sha256(jvmAliasConsumer(run.profile)));
		assert.equal(run.jvm.consumerSourceSha256, record.consumerHashes[run.profile]);
		assert.equal(run.jvm.signaturesSha256, sha256(jvmAliasPublicChecks(run.profile)));
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "observationSha256", "contractSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly", "exactPublicSignatures", "runtimeOverridesDisabled"]) assert.equal(run.jvm[key], true, key);
		assert.deepEqual(run.jvm.runtimeModules, ["java.base@22.0.2"]);
		assert.equal(run.jvm.deployment["package.jar"].sha256, run.jvm.archiveSha256);
		const shared = record.executions.find(other => other.path === run.path && other.profile !== run.profile);
		assert.deepEqual(run.packages, shared.packages); assert.equal(run.jvm.archiveSha256, shared.jvm.archiveSha256);
		assert.deepEqual(run.jvm.nativeLibraries, record.executions[0].jvm.nativeLibraries);
		assert.equal(run.catalog.aliases.length, 27);
		assert.deepEqual(run.catalog.aliases.map(({ id, name, target }) => ({ id, name, target })), nativeAliasReviewedIr().types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target })));
		for(const flag of ["transparentTargetTypes", "installedSourceDocumentation", "originalAliasChains"]) assert.equal(run.catalog[flag], true);
		assert.equal(run.faultProbe, run.path);
		const expected = jvmAliasRejections(run.profile); assert.equal(expected.length, 12);
		assert.deepEqual(run.rejected.map(result => result.id), expected.map(result => result.id));
		for(const [index, result] of run.rejected.entries())
		{
			assert.equal(result.sourceSha256, sha256(expected[index].source));
			assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [expected[index].expectation.diagnostic].flat());
			assert.ok(result.diagnostics.every(diagnostic => diagnostic.file.startsWith("src/reject-") && diagnostic.line > 0 && diagnostic.column > 0));
		}
	}
	for(const probe of Object.values(record.faultProbes))
	{
		assert.equal(probe.checks, 237); assert.equal(probe.layoutChecks, 18); assert.equal(probe.partialInputChecks, 64);
		assert.deepEqual(probe.replacements, [56, 31, 65, 1, 31, 13]);
		assert.equal(probe.probeSourceSha256, sha256(await readFile("tests/fixtures/alias-consumers/jvm-faults.java")));
		for(const key of ["isolatedInstrumentedProjection", "releaseJarUnchanged", "normalExitCleanup"]) assert.equal(probe[key], true);
		assert.deepEqual(Object.keys(probe.originalSources), Object.keys(probe.instrumentedSources).filter(path => !/\/(?:AliasProbe|Faults)\.java$/.test(path)));
		for(const [path, hash] of Object.entries(probe.originalSources))
			if(!/\/(?:Runtime|Scope)\.java$/.test(path)) assert.equal(probe.instrumentedSources[path], hash, path);
	}
});

test("JVM alias installed evidence promotes exactly twelve cells and runs in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => ["java", "kotlin"].includes(cell.profile) && cell.shape === "alias" && ["parameter", "result", "field"].includes(cell.position));
	assert.equal(cells.length, 12);
	for(const cell of cells) for(const stage of Object.values(cell.stages))
	{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["jvm-aliases-installed"]); }
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_JVM_ALIAS_TEST=1 node --test tests\/jvm-aliases.test.mjs/);
	assert.match(workflow, /test -s build\/aliases\/jvm\.json/);
	assert.match(workflow, /path: \|[^]*?build\/aliases\/jvm\.json/);
});

test("JVM aliases retain contract identities, transparent targets and per-site documentation", () => {
	const ir = nativeAliasReviewedIr(), files = generateCopiedJvmPackage(ir), manifest = JSON.parse(files["binding-manifest.json"]);
	assert.deepEqual(files, generateCopiedJvmPackage(structuredClone(ir)));
	assert.deepEqual(files, generateJvmBindingPackage(ir)); auditManagedBindingPackage(ir, files, "jvm");
	assert.equal(manifest.aliases.length, 27);
	assert.deepEqual(manifest.aliases.map(({ id, name, target }) => ({ id, name, target })), ir.types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target })));
	const aliases = Object.fromEntries(manifest.aliases.map(alias => [alias.name, alias]));
	for(const [name, java, kotlin] of [["ANat", "java.math.BigInteger", "java.math.BigInteger"], ["Count", "long", "Long"], ["Rows", "long[][]", "Array<LongArray>"], ["Packets", "Packet[]", "Array<Packet>"], ["Maybe", "Option<Option<Unit>>", "Option<Option<Unit>>"], ["Outcome", "Result<Pair<Long, byte[]>, String>", "Result<Pair<Long, ByteArray>, String>"]])
	{
		assert.equal(aliases[name].javaType, java); assert.equal(aliases[name].kotlinType, kotlin);
	}
	assert.deepEqual(aliases.Count.target, { kind: "named", id: "lean:Aliases.AU32" });
	assert.match(files[`${prefix}Api.java`], /@param arg0 Contract type: <code>Count<\/code>/);
	assert.match(files[`${prefix}Api.java`], /@return Contract type: <code>OtherCount<\/code>/);
	assert.match(files[`${prefix}Packet.java`], /@param rows Contract type: <code>Rows<\/code>/);
	assert.match(files[`${prefix}Scalars.java`], /@param vNat Contract type: <code>ANat<\/code>/);
	assert.match(files[`${prefix}Api.java`], /long\[\]\[\] reverseRows\(long\[\]\[\] arg0\)/);
	assert.match(files[`${prefix}Api.java`], /void echoUnit\(Unit arg0\)/);
	assert.match(files["README.md"], /do not introduce JVM classes or exported Kotlin typealias declarations/);
	assert.ok(!Object.keys(files).some(path => /\/Count.java$|\.kt$/.test(path)));
	const model = compileCopiedJvmModel(ir);
	for(const [field, size, offsets] of [["echo_maybe", 3, [1]], ["echo_outcome", 80, [8, 48]]])
	{
		const copy = model.surface.copy(model.surface.functions.find(fn => fn.field === field).declaration.result.type);
		assert.equal(copy.size, size); assert.deepEqual(copy.fields.map(field => field.offset), offsets);
	}
});

test("alias-only names cannot inject Javadoc syntax or create JVM identities", () => {
	const ir = nativeAliasReviewedIr(); ir.types.find(type => type.name === "Count").name = "*/{@link Api}<script>&";
	assert.throws(() => generateCopiedJvmPackage(ir), /name has an invalid value/);
	const model = compileCopiedJvmModel(nativeAliasReviewedIr());
	model.surface.aliases.find(alias => alias.definition.name === "Count").definition.name = "*/{@link Api}<script>&";
	const documentation = jvmAliasCatalogDocs(model);
	assert.match(documentation, /\*&#47;&#123;@link Api&#125;&lt;script&gt;&amp;/);
	assert.doesNotMatch(documentation, /\*\/\{@link/);
	const collision = nativeAliasReviewedIr(); collision.types.find(type => type.name === "Count").name = "Api";
	assert.doesNotThrow(() => generateCopiedJvmPackage(collision));
});

test("alias-free JVM APIs gain no alias catalog or empty documentation", () => {
	const files = generateCopiedJvmPackage(callableReviewedIr());
	assert.equal(JSON.parse(files["binding-manifest.json"]).aliases, undefined);
	assert.doesNotMatch(files["README.md"], /Copied Lean aliases/);
	assert.ok(Object.entries(files).filter(([path]) => path.endsWith(".java")).every(([, source]) => !source.includes("Contract type:")));
});

const environment = nativeFixtureEnvironment(["java", "kotlin"]);
test("JVM alias sources, Javadoc and independent Java/Kotlin consumers compile with warnings denied", { skip: !existsSync(environment.LEAN_BRIDGE_JAVAC) || !existsSync(environment.LEAN_BRIDGE_KOTLINC), timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-alias-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedJvmPackage(nativeAliasReviewedIr()), sources = Object.keys(files).filter(path => path.endsWith(".java"));
	for(const path of sources) await saveLakeFile(root, path, files[path]);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-d", "classes", ...sources], root);
	await runCopied(join(dirname(environment.LEAN_BRIDGE_JAVAC), "javadoc"), ["-quiet", "-Xdoclint:all,-missing", "-Werror", "-d", "docs", ...sources], root);
	for(const profile of ["java", "kotlin"])
	{
		await saveLakeFile(root, `Consumer.${profile === "java" ? "java" : "kt"}`, jvmAliasConsumer(profile));
		await saveLakeFile(root, "Wire.java", await readFile("tests/fixtures/type-corpus/consumers/Wire.java"));
		await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, "-cp", "classes", "-d", "classes", "Wire.java", ...profile === "java" ? ["Consumer.java"] : []], root);
		if(profile === "kotlin")
		{
			const kotlinRoot = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), lib = join(kotlinRoot, "lib");
			await runCopied(environment.LEAN_BRIDGE_JAVA, ["-cp", join(lib, "*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-kotlin-home", kotlinRoot, ...kotlinCompilerOptions, "-jdk-home", dirname(dirname(environment.LEAN_BRIDGE_JAVA)), "-cp", `classes:${join(lib, "kotlin-stdlib.jar")}:${join(lib, "annotations-13.0.jar")}`, "-d", "classes", "Consumer.kt"], root);
		}
	}
});
