/**
 * Genuine Kotlin types, original Maven archives and source-free installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { jvmCollectionConsumer, jvmCollectionDocumentation, jvmCollectionPublicChecks, jvmCollectionRejections } from "./helpers/jvm-collection-fixture.mjs";
import { jvmKotlinMetadataConsumer } from "./helpers/jvm-kotlin-metadata-fixture.mjs";
import { jvmHistoricalReceipts, readJvmHistoricalEvidence } from "./helpers/jvm-source-history.mjs";
import { compoundReviewedIr } from "./helpers/compound-source-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { cVariantReviewedIr } from "./helpers/c-variant-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { jvmCallableSignatures } from "./helpers/jvm-callable-fixture.mjs";
import { assertCurrentKotlinCollectionSources } from "./helpers/current-collection-evidence.mjs";
import { beforeJvmStructuredCallables } from "./helpers/jvm-structured-callable-source-history.mjs";

const receipt = async () => JSON.parse(await readFile("docs/evidence/kotlin-collections-20260922.json"));
const digest = value => sha256(canonicalJson(value));
const observations = run => ({ checks: run.checks
	, calls: run.calls
	, rejected: run.rejected
	, results: run.observation.results
	, faults: run.faults
	, documentation: run.documentation });
const executionOrder = ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"];
// Compiler-owned IR orders definitions by identity, unlike the independent fixture.
const generatedSources = fixture => {
	const ir = fixture();
	for(const key of ["declarations", "types"]) ir[key].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	return generateCopiedJvmKotlinPackage(ir);
};
const assertLog = (log, tests) => {
	assert.equal(log.sha256, sha256(log.text));
	assert.ok(log.text.includes(`# tests ${tests}\n# suites 0\n# pass ${tests}\n# fail 0`));
	assert.match(log.text, /# cancelled 0\n# skipped 0\n# todo 0/);
};
const assertInstalled = run => {
	assert.equal(run.sourceRemovedBeforeInstallation, true);
	for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
		assert.match(run[key], /^[a-f0-9]{64}$/);
	const jvm = run.jvm;
	for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries"])
		assert.equal(jvm[key], true, key);
	assert.deepEqual(jvm.runtimeModules, ["java.base@22.0.2"]);
	assert.equal(jvm.deployment["package.jar"].sha256, jvm.archiveSha256);
	assert.deepEqual(jvm.resolvedDependencies.map(item => item.mavenPath), [
		"org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar"
		, "org/jetbrains/annotations/13.0/annotations-13.0.jar"
	]);
	for(const item of jvm.resolvedDependencies) assert.match(item.sha256, /^[a-f0-9]{64}$/);
	assert.equal(run.packages.length, 1);
	assert.equal(run.packages[0].target, "maven");
	assert.equal(run.packages[0].runtimeDelivery, "embedded");
	assert.deepEqual(run.packages[0].requires, []);
	const artifacts = run.packages[0].artifacts;
	assert.equal(artifacts.find(item => item.path.endsWith(".jar")).sha256, jvm.archiveSha256);
	assert.equal(artifacts.find(item => item.path.endsWith(".pom")).sha256, jvm.pomSha256);
};

test("Kotlin collections bind current sources to both original installed source paths", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["java", "kotlin"]);
	assert.equal(record.jdk, "22.0.2"); assert.equal(record.kotlin, "2.2.0");
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	await assertCurrentKotlinCollectionSources(record);
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, digest(collectionReviewedIr()));
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, digest(record.signatures));
		return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, digest({ schemaVersion: 1, profiles: record.profiles, reports }));
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.profile}`), executionOrder);
	const sources = generatedSources(collectionReviewedIr);
	for(const run of record.executions)
	{
		assertInstalled(run);
		assert.equal(run.checks, run.profile === "java" ? 158171 : 158334);
		assert.equal(run.calls, 4435); assert.equal(run.rejected, 30);
		assert.equal(run.jvm.consumerSourceSha256, sha256(jvmCollectionConsumer(run.profile)));
		assert.equal(run.jvm.signaturesSha256, sha256(jvmCollectionPublicChecks(run.profile)));
		for(const key of ["publicApiOnly", "exactPublicSignatures", "runtimeOverridesDisabled", "handoffRemovedBeforeExecution"]) assert.equal(run.jvm[key], true);
		assert.equal(Object.keys(run.installedFiles).length, 77);
		// NativeAssets embeds compiled library identities checked below and by the installed loader.
		for(const [path, source] of Object.entries(sources).filter(([path]) => /\.(java|kt)$/.test(path) && !path.endsWith("/NativeAssets.java")))
			assert.equal(run.installedFiles[`META-INF/lean-bridge/jvm/${path}`].sha256, sha256(source), path);
		for(const path of ["org/leanbridge/collections/Api.class", "org/leanbridge/collections/kotlin/Api.class", "META-INF/lean_bridge_org_leanbridge_collections.kotlin_module"])
			assert.ok(run.installedFiles[path]);
		assert.deepEqual(run.observation.errors, []);
		assert.deepEqual(run.observation.nativeLibraries, run.jvm.nativeLibraries);
		for(const [name, hash] of Object.entries(run.jvm.nativeLibraries))
			assert.equal(run.installedFiles[`META-INF/lean-bridge/native/linux-x64/${name}`].sha256, hash);
		const expected = jvmCollectionRejections(run.profile), rejected = run.observation.results.filter(item => item.status === "rejected-at-compile-time");
		assert.equal(rejected.length, 8); assert.deepEqual(rejected.map(item => item.id), expected.map(item => item.id));
		for(const [index, result] of rejected.entries())
		{
			assert.equal(result.sourceSha256, sha256(expected[index].source));
			assert.deepEqual(result.diagnostics.map(item => item.code), [expected[index].expectation.diagnostic].flat());
			for(const diagnostic of result.diagnostics) assert.ok(diagnostic.line > 0 && diagnostic.column > 0);
		}
		const faults = run.faults;
		assert.equal(faults.checkpoints, 679); assert.equal(faults.checks, run.profile === "java" ? 2979 : 2993); assert.equal(faults.partialInputs, 64);
		assert.deepEqual(faults.malformed, { checks: 984, nativeCalls: 0, rejected: 562 });
		for(const key of ["allArenasClosed", "outputsClearedExactlyOnce", "isolatedInstrumentedProjection", "releaseJarUnchanged", "normalExitCleanup"]) assert.equal(faults[key], true);
		if(run.profile === "kotlin")
		{
			assert.equal(faults.profile, "kotlin"); assert.equal(faults.runtime, "KotlinRuntime");
			assert.equal(faults.compiledKotlinApiFromOriginalJar, true);
		}
		for(const [path, hash] of Object.entries(faults.originalSources))
			assert.equal(run.installedFiles[`META-INF/lean-bridge/jvm/${path}`].sha256, hash);
		const example = jvmCollectionDocumentation(run.profile);
		assert.equal(run.documentation.sourceSha256, sha256(example.source)); assert.equal(run.documentation.stdout, example.stdout);
		for(const key of ["sourceFreeExecution", "compilerFreeExecution", "repeatExecution"]) assert.equal(run.documentation[key], true);
		const other = record.executions.find(item => item.path === run.path && item.profile !== run.profile);
		assert.deepEqual(run.packages, other.packages); assert.deepEqual(run.installedFiles, other.installedFiles);
	}
});

test("Kotlin collection archives, installed files and observations reproduce independently", async () => {
	const record = await receipt(), reproduction = record.reproduction;
	for(const key of ["archivesIdentical", "nativeLibrariesIdentical", "installedFilesIdentical", "publicObservationsIdentical", "deploymentsIdentical", "resolvedDependenciesIdentical"]) assert.equal(reproduction[key], true);
	assert.equal(reproduction.runs.length, 4);
	for(const previous of reproduction.runs)
	{
		const run = record.executions.find(item => item.path === previous.path && item.profile === previous.profile); assert.ok(run);
		for(const key of ["installedFiles", "packages"]) assert.equal(previous[`${key}Sha256`], digest(run[key]));
		for(const key of ["nativeLibraries", "deployment", "resolvedDependencies"]) assert.equal(previous[`${key}Sha256`], digest(run.jvm[key]));
		assert.equal(previous.observationsSha256, digest(observations(run)));
	}
	assertLog(reproduction.firstLog, 1); assertLog(reproduction.secondLog, 1);
	assert.notEqual(reproduction.firstLog.sha256, reproduction.secondLog.sha256);
	assertLog(record.callerPreflight.log, 2);
	assert.equal(record.callerPreflight.sourceSha256, record.sourceHashes["tests/jvm-collection-callers.test.mjs"]);
});

test("Kotlin companion API retains installed JVM compounds, lists, aliases, variants and callable owners", async () => {
	const record = await receipt();
	const fixtures = { callables: () => callableReviewedIr(jvmCallableSignatures), compounds: compoundReviewedIr, lists: listReviewedIr, aliases: nativeAliasReviewedIr, variants: cVariantReviewedIr };
	const checks = { callables: [66683, 66655, 118, [6, 6]], compounds: [36872, 36872, 1588, [10, 11]], lists: [91674, 91696, 122, [12, 12]], aliases: [3711, 3711, 103, [12, 12]], variants: [209998, 209998, 25, [10, 10]] };
	assert.deepEqual(record.regressions.map(run => run.name), Object.keys(fixtures));
	for(const regression of record.regressions)
	{
		assertLog(regression.log, 1); assert.equal(regression.sourceSha256, record.sourceHashes[regression.test]);
		assert.deepEqual(regression.executions.map(run => `${run.path}/${run.profile}`), executionOrder);
		const sources = generatedSources(fixtures[regression.name]);
		for(const run of regression.executions)
		{
			assertInstalled(run);
			const [java, kotlin, metadata, negatives] = checks[regression.name];
			assert.equal(run.checks, run.profile === "java" ? java : kotlin);
			assert.equal(run.compilerRejections.length, negatives[run.profile === "java" ? 0 : 1]);
			assert.equal(run.jvm.declarationsSha256, sha256(sources[`src/main/java/org/leanbridge/${regression.name}/Api.java`]));
			if(run.profile === "kotlin")
			{
				assert.equal(run.jvm.kotlinMetadataChecks, metadata);
				assert.equal(run.jvm.kotlinMetadataSourceSha256, sha256(jvmKotlinMetadataConsumer(regression.name)));
				assert.equal(run.metadataObservation.observed.integer, String(metadata));
				assert.equal(run.metadataObservation.status, "matched");
				assert.ok(run.jvm.deployment["classes/MetadataKt.class"]);
			}
			if(run.faults)
			{
				assert.ok(run.faults.checks >= 140);
				assert.equal(run.faults.releaseJarUnchanged, true); assert.equal(run.faults.normalExitCleanup, true);
			}
		}
	}
	assertLog(record.nativeRegression.log, 4);
	assert.equal(record.nativeRegression.sourceSha256, record.sourceHashes["tests/native-jvm.test.mjs"]);
	for(const probe of [record.conversion, record.equality])
	{ assert.equal(probe.compiledLean, false); assert.equal(probe.installedPackage, false); }
	assert.deepEqual(record.conversion.observation, { checks: 984, nativeCalls: 0, rejected: 562 });
	assert.equal(record.equality.observations.java.checks, 32069); assert.equal(record.equality.observations.kotlin.checks, 15642);
});

test("Kotlin source lineage preserves all prior JVM receipt bytes and requires current hashes", async () => {
	const record = await receipt();
	assert.deepEqual(Object.keys(record.sourceLineage).sort(), Object.keys(jvmHistoricalReceipts).sort());
	for(const [name, hash] of Object.entries(jvmHistoricalReceipts))
	{
		const previous = await readJvmHistoricalEvidence(name), sources = {};
		const oldHashes = { ...previous.sourceHashes, ...Object.fromEntries((previous.regressions ?? []).map(run => [run.test, run.sourceSha256])) };
		for(const [path, previousSha256] of Object.entries(oldHashes))
		{
			const currentSha256 = sha256(beforeJvmStructuredCallables(path, await readFile(path, "utf8"), previousSha256));
			if(currentSha256 === previousSha256) continue;
			assert.equal(record.sourceHashes[path], currentSha256, path);
			sources[path] = { previousSha256, currentSha256 };
		}
		assert.deepEqual(record.sourceLineage[name], { receiptSha256: hash, sources });
	}
});

test("Kotlin collections promote exactly 22 reviewed cells and run both languages in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts), promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("kotlin-collections-installed"));
	assert.equal(promoted.length, 22);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "kotlin"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["kotlin-collections-installed"]); }
	}
	for(const cell of cells.filter(cell => cell.profile === "kotlin" && ["array", "record"].includes(cell.shape) && cell.position.startsWith("callback-")))
	{
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.deepEqual(cell.stages.installedExecution.evidence, ["jvm-structured-callables-installed"]);
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_JVM_COLLECTION_TEST=1 LEAN_BRIDGE_JVM_COLLECTION_PROFILES=java,kotlin node --test tests/jvm-collections.test.mjs"));
	assert.ok(workflow.includes("test -s build/collections/jvm.json"));
	assert.ok(workflow.split("path: |\n").some(block => block.includes("build/collections/jvm.json")));
});
