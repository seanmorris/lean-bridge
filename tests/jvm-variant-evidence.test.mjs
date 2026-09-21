/**
 * Original Maven variant archives, independent consumers and isolated probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";
import { jvmVariantConsumer, jvmVariantRejections } from "./helpers/jvm-variant-fixture.mjs";

test("Maven variant evidence binds both languages to original archives and independent checks", async () => {
	const record = JSON.parse(await readFile("docs/evidence/jvm-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.equal(record.jdk, "22.0.2"); assert.equal(record.kotlin, "2.2.0");
	assert.deepEqual(record.profiles, ["java", "kotlin"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.signatures, cVariantSignatures()); assert.deepEqual(record.types, cVariantReviewedIr().types);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(cVariantReviewedIr())));
	assert.equal(record.types.filter(type => type.kind === "variant").length, 7);
	assert.equal(record.types.flatMap(type => type.cases).length, 18);
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const run of record.executions)
	{
		assert.equal(run.checks, 209998); assert.equal(run.calls, 4331); assert.equal(run.rejected, 33);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "observationSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		const jvm = run.jvm, files = record.installations[run.path];
		assert.equal(jvm.consumerSourceSha256, sha256(jvmVariantConsumer(run.profile)));
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly", "exactPublicSignatures", "runtimeOverridesDisabled", "handoffRemovedBeforeExecution"]) assert.equal(jvm[key], true, key);
		assert.deepEqual(jvm.runtimeModules, ["java.base@22.0.2"]);
		assert.equal(jvm.deployment["package.jar"].sha256, jvm.archiveSha256);
		assert.ok(jvm.dependencies.fileCount > 0);
		for(const key of ["runtimeFilesSha256", "mavenFilesSha256", "compiledProjectionSha256", "signaturesSha256", "packageReceiptSha256"]) assert.match(jvm[key], /^[a-f0-9]{64}$/);
		const expected = jvmVariantRejections(run.profile);
		assert.equal(expected.length, 10); assert.deepEqual(run.compilerRejections.map(result => result.id), expected.map(result => result.id));
		for(const [index, result] of run.compilerRejections.entries())
		{
			assert.equal(result.sourceSha256, sha256(expected[index].source));
			assert.deepEqual(result.diagnostics.map(diagnostic => diagnostic.code), [expected[index].expectation.diagnostic].flat());
			for(const diagnostic of result.diagnostics)
			{ assert.ok(diagnostic.line > 0); assert.ok(diagnostic.column > 0); }
		}
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "maven"); assert.equal(pkg.name, "org.leanbridge:variants"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
		assert.deepEqual(pkg.artifacts.map(artifact => artifact.path), ["archives/variants-1.0.0.jar", "archives/variants-1.0.0.pom"]);
		assert.equal(pkg.artifacts[0].sha256, jvm.archiveSha256); assert.equal(pkg.artifacts[1].sha256, jvm.pomSha256);
		for(const [name, hash] of Object.entries(jvm.nativeLibraries)) assert.equal(files[`META-INF/lean-bridge/native/linux-x64/${name}`].sha256, hash);
		const faults = record.faultProbes[run.path];
		assert.equal(faults.checks, 212); assert.equal(faults.partialInputChecks, 64);
		assert.equal(faults.layoutChecks, 13); assert.equal(faults.malformedTags, 7); assert.equal(faults.inactiveCases, 6);
		assert.equal(faults.isolatedInstrumentedProjection, true); assert.equal(faults.releaseJarUnchanged, true); assert.equal(faults.normalExitCleanup, true);
		assert.deepEqual(faults.replacements, [66, 14, 32, 1, 14, 12]);
		assert.equal(faults.probeSourceSha256, record.sourceHashes["tests/fixtures/variant-consumers/jvm-faults.java"]);
		for(const [path, hash] of Object.entries(faults.originalSources))
		{
			assert.equal(files[`META-INF/lean-bridge/jvm/${path}`].sha256, hash);
			if(!/\/(?:Runtime|Scope)\.java$/.test(path)) assert.equal(faults.instrumentedSources[path], hash);
			else assert.notEqual(faults.instrumentedSources[path], hash);
		}
		const native = record.nativeFaultProbes[run.path];
		assert.equal(native.checks, 1182); assert.equal(native.allocationFailures, 242); assert.equal(native.rejected, 70); assert.equal(native.malformedNativeTags, 1);
		assert.equal(native.syntheticTagInjection, true); assert.equal(native.realLeanExecution, true);
		assert.equal(native.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/native-probe.c"]);
		assert.deepEqual(native.sanitizers, ["address", "leak", "undefined"]);
		assert.equal(native.startupLeakBaseline.unchangedAfterConversions, true);
		assert.equal(native.startupLeakBaseline.bytes, 128); assert.equal(native.startupLeakBaseline.allocations, 12);
	}
	for(const profile of record.profiles) assert.doesNotMatch(jvmVariantConsumer(profile), /MemorySegment|ValueLayout|lean_obj_tag|lean_ctor_get|MethodHandles/);
	assert.match(record.reportSha256, /^[a-f0-9]{64}$/);
	assert.match(record.reproduction.firstReportSha256, /^[a-f0-9]{64}$/);
	assert.equal(record.reproduction.executions, 4); assert.equal(record.reproduction.archivesIdentical, true);
	assert.equal(record.reproduction.installedFilesIdentical, true); assert.equal(record.reproduction.generatedSourcesIdentical, true);
});

test("Maven variants promote exactly twelve copied cells and require installed CI receipts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("jvm-variants-installed"));
	assert.equal(cells.length, 12);
	for(const cell of cells)
	{
		assert.ok(["java", "kotlin"].includes(cell.profile)); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["jvm-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_JVM_VARIANT_TEST=1 node --test tests\/jvm-variants\.test\.mjs/);
	assert.match(workflow, /test -s build\/variants\/jvm\.json/);
	assert.match(workflow, /path: \|[^]*?build\/variants\/jvm\.json/);
});
