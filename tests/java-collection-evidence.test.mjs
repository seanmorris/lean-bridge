/**
 * Bind Java collection support to original Maven archives and runtime-only calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { generateCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { jvmCollectionConsumer, jvmCollectionDocumentation, jvmCollectionPublicChecks, jvmCollectionRejections } from "./helpers/jvm-collection-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";
import { assertJvmHistoricalSource, readJvmHistoricalEvidence } from "./helpers/jvm-source-history.mjs";

const receipt = () => readJvmHistoricalEvidence("java-collections-20260922");
const observations = run => ({ checks: run.checks
	, calls: run.calls
	, rejected: run.rejected
	, results: run.observation.results
	, faults: run.faults
	, documentation: run.documentation });

test("Java collections retain original archives, typed callers and source-free documentation execution", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["java"]);
	assert.equal(record.jdk, "22.0.2"); assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertJvmHistoricalSource("java-collections-20260922", path, hash);
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, sha256(canonicalJson(record.signatures)));
		return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, profiles: ["java"], reports })));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const example = jvmCollectionDocumentation();
	for(const run of record.executions)
	{
		assert.equal(run.profile, "java"); assert.equal(run.checks, 158171); assert.equal(run.calls, 4435); assert.equal(run.rejected, 30);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"])
			assert.match(run[key], /^[a-f0-9]{64}$/);
		const jvm = run.jvm;
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly", "exactPublicSignatures", "runtimeOverridesDisabled", "handoffRemovedBeforeExecution"])
			assert.equal(jvm[key], true, key);
		assert.deepEqual(jvm.runtimeModules, ["java.base@22.0.2"]);
		assert.equal(jvm.consumerSourceSha256, sha256(jvmCollectionConsumer("java")));
		assert.equal(jvm.signaturesSha256, sha256(jvmCollectionPublicChecks("java")));
		assert.equal(jvm.deployment["package.jar"].sha256, jvm.archiveSha256);
		assert.ok(jvm.deployment["classes/Example.class"]);
		assert.ok(Object.keys(jvm.dependencies.files).length > 100);
		assert.match(jvm.dependencies.sha256, /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "maven"); assert.equal(pkg.name, "org.leanbridge:collections"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
		assert.deepEqual(pkg.artifacts.map(artifact => artifact.path), ["archives/collections-1.0.0.jar", "archives/collections-1.0.0.pom"]);
		assert.equal(pkg.artifacts[0].sha256, jvm.archiveSha256); assert.equal(pkg.artifacts[1].sha256, jvm.pomSha256);
		assert.equal(Object.keys(run.installedFiles).length, 49);
		assert.equal(Object.keys(jvm.nativeLibraries).length, 4);
		for(const [name, hash] of Object.entries(jvm.nativeLibraries))
			assert.equal(run.installedFiles[`META-INF/lean-bridge/native/linux-x64/${name}`].sha256, hash);
		assert.deepEqual(run.observation.nativeLibraries, jvm.nativeLibraries);
		assert.deepEqual(run.observation.errors, []);
		const expected = jvmCollectionRejections("java"), rejected = run.observation.results.filter(result => result.status === "rejected-at-compile-time");
		assert.equal(rejected.length, 8); assert.deepEqual(rejected.map(result => result.id), expected.map(result => result.id));
		for(const [index, result] of rejected.entries())
		{
			assert.equal(result.sourceSha256, sha256(expected[index].source));
			assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [expected[index].expectation.diagnostic]);
			for(const diagnostic of result.diagnostics)
			{ assert.ok(diagnostic.line > 0); assert.ok(diagnostic.column > 0); }
		}
		const faults = run.faults;
		assert.equal(faults.checkpoints, 679); assert.equal(faults.checks, 2979); assert.equal(faults.partialInputs, 64);
		assert.deepEqual(faults.malformed, { checks: 984, nativeCalls: 0, rejected: 562 });
		for(const key of ["allArenasClosed", "outputsClearedExactlyOnce", "isolatedInstrumentedProjection", "releaseJarUnchanged", "normalExitCleanup"])
			assert.equal(faults[key], true);
		assert.equal(faults.probeSourceSha256, record.sourceHashes["tests/fixtures/collection-consumers/jvm-faults.java"]);
		for(const [path, hash] of Object.entries(faults.originalSources))
		{
			assert.equal(run.installedFiles[`META-INF/lean-bridge/jvm/${path}`].sha256, hash);
			if(!/\/(?:Runtime|Scope)\.java$/.test(path)) assert.equal(faults.instrumentedSources[path], hash);
			else assert.notEqual(faults.instrumentedSources[path], hash);
		}
		assert.equal(run.documentation.sourceSha256, sha256(example.source)); assert.equal(run.documentation.stdout, example.stdout);
		for(const key of ["sourceFreeExecution", "compilerFreeExecution", "repeatExecution"]) assert.equal(run.documentation[key], true);
		assert.equal(run.observation.results.find(result => result.id === "collections/documentation").observed.string, example.stdout);
	}
	for(const key of ["archivesIdentical", "nativeLibrariesIdentical", "installedFilesIdentical", "publicObservationsIdentical"])
		assert.equal(record.reproduction[key], true);
	assert.equal(record.reproduction.runs.length, 2);
	for(const previous of record.reproduction.runs)
	{
		const run = record.executions.find(run => run.path === previous.path); assert.ok(run);
		assert.equal(previous.installedFilesSha256, sha256(canonicalJson(run.installedFiles)));
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.nativeLibrariesSha256, sha256(canonicalJson(run.jvm.nativeLibraries)));
		assert.equal(previous.observationsSha256, sha256(canonicalJson(observations(run))));
	}
	const { firstLog, secondLog } = record.reproduction; assert.notEqual(firstLog.sha256, secondLog.sha256);
	for(const log of [firstLog, secondLog])
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0/);
		for(const path of ["ordinary-source", "reviewed-ir"]) assert.ok(log.text.includes(`${path}/java: 158171 assertions, 4435 calls, 30 rejected inputs, 679 injected failures`));
	}
	assert.doesNotMatch(jvmCollectionConsumer("java"), /MemorySegment|MethodHandles|ValueLayout|setAccessible/);
});

test("JVM conversion and equality evidence distinguishes host checks from installed Lean execution", async () => {
	const { conversion, equality, regressions } = await receipt();
	for(const preflight of [conversion, equality])
	{
		assert.equal(preflight.compiledLean, false); assert.equal(preflight.installedPackage, false);
	}
	assert.deepEqual(conversion.observation, { checks: 984, nativeCalls: 0, rejected: 562 });
	assert.equal(conversion.probeSourceSha256, sha256(await readFile("tests/fixtures/collection-consumers/jvm-conversions.java")));
	const javaSources = fixture => Object.fromEntries(Object.entries(generateCopiedJvmPackage(fixture())).filter(([path]) => path.endsWith(".java")).map(([path, source]) => [path, sha256(source)]));
	assert.deepEqual(conversion.generatedSourceHashes, javaSources(collectionReviewedIr));
	assert.deepEqual(equality.generatedSourceHashes, Object.assign({}, ...[collectionReviewedIr, compoundReviewedIr, listReviewedIr, nativeAliasReviewedIr, nativeVariantReviewedIr].map(javaSources)));
	for(const [profile, extension, checks] of [["java", "java", 32069], ["kotlin", "kt", 15642]])
	{
		assert.equal(equality.consumerHashes[profile], sha256(await readFile(`tests/fixtures/collection-consumers/jvm-equality.${extension}`)));
		assert.deepEqual(equality.observations[profile], { checks, generatedProfiles: 5, fixedArrayDepth: 24, nativeCalls: 0 });
	}
	assert.deepEqual(regressions.map(run => run.name), ["compounds", "lists", "aliases", "variants", "callables", "native"]);
	for(const run of regressions)
	{
		await assertJvmHistoricalSource("java-collections-20260922", run.test, run.sourceSha256);
		assert.equal(run.log.sha256, sha256(run.log.text));
		assert.equal(run.tests, run.name === "native" ? 4 : 1);
		assert.ok(run.log.text.includes(`# tests ${run.tests}\n# suites 0\n# pass ${run.tests}\n# fail 0`));
	}
});

test("Java collections promote only reviewed copied positions and require original CI evidence", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("java-collections-installed"));
	assert.equal(observed.length, 22);
	for(const cell of observed)
	{
		assert.equal(cell.profile, "java"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["java-collections-installed"]); }
	}
	for(const cell of cells.filter(cell => cell.profile === "java" && ["array", "record"].includes(cell.shape) && cell.position.startsWith("callback-")))
	{
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.deepEqual(cell.stages.installedExecution.evidence, ["jvm-structured-callables-installed"]);
	}
	assert.ok(!observed.some(cell => cell.profile === "kotlin"));
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const [command, report] of [
		["LEAN_BRIDGE_JVM_COLLECTION_TEST=1 LEAN_BRIDGE_JVM_COLLECTION_PROFILES=java,kotlin node --test tests/jvm-collections.test.mjs", "collections/jvm"]
		, ["LEAN_BRIDGE_JVM_CONVERSIONS_TEST=1 node --test tests/jvm-collection-conversions.test.mjs", "collections/jvm-conversions"]
		, ["LEAN_BRIDGE_JVM_EQUALITY_TEST=1 node --test tests/jvm-value-equality.test.mjs", "equality/jvm"]
	]) {
		assert.ok(workflow.includes(command)); assert.ok(workflow.includes(`test -s build/${report}.json`));
		assert.ok(workflow.split("path: |\n").some(block => block.includes(`build/${report}.json`)));
	}
});
