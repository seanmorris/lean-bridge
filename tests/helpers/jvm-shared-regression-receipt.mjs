/**
 * Bind JVM graph compiler changes to unchanged installed acyclic packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeJvmSharedVerification } from "./jvm-shared-verifier-updates.mjs";
import { beforeNativeSharedVerification } from "./native-shared-verifier-updates.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const receiptPath = "docs/evidence/jvm-shared-regressions-20260924.json";
export const jvmSharedProductionPaths = [
	"src/build/compile-jvm-sources.mjs"
	, "src/build/native-jvm-artifacts.mjs"
	, "src/build/native-jvm-projection.mjs"
	, "src/release/native-maven.mjs"
];
const verifierPaths = [
	"tests/helpers/php-wasm-shared-regression-receipt.mjs"
	, "tests/helpers/test-registration-history.mjs"
];
const same = (current, previous, keys) => {
	for(const key of keys) assert.deepEqual(current[key], previous[key], key);
};

/**
 * Identify execution sources separately from registration and receipt checkers.
 *
 * @param baseline - Authenticated original JVM execution record.
 */
export const jvmSharedExecutionPaths = baseline => [...new Set([
	...Object.keys(baseline.sourceHashes).filter(path => ![
		"src/adoption/test-profiles.mjs"
		, "tests/helpers/native-graph-jvm-regression.mjs"
		, "tests/helpers/recursive-source-history.mjs"
	].includes(path))
	, "src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/managed/package-audit.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/native-graph-projection.mjs"
])].sort();

/**
 * Require all four installed runs, original archives and complete failure probes.
 * This establishes JVM compatibility, not the final cross-language inventory.
 *
 * @param record - Fresh immutable execution and source snapshots.
 */
export const assertJvmSharedRegressionEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "jvm-shared-regressions"); assert.equal(record.finalAcceptance, false);
	assert.equal(record.packageGlibcFloor, "2.36"); assert.equal(record.wordBits, 64);
	assert.equal(record.baseline.path, "docs/evidence/native-recursive-jvm-regression-20260923.json");
	const bytes = await readFile(record.baseline.path);
	assert.equal(sha256(bytes), record.baseline.sha256);
	const baseline = JSON.parse(bytes);
	assert.equal(baseline.packageGlibcFloor, record.packageGlibcFloor);
	assert.deepEqual(Object.keys(record.predecessors).sort(), jvmSharedProductionPaths);
	for(const [path, previous] of Object.entries(record.predecessors))
	{
		assert.equal(previous.sha256, baseline.sourceHashes[path], path);
		assert.equal(sha256(previous.text), previous.sha256, path);
	}
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), jvmSharedExecutionPaths(baseline));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(beforeWitPackageIntegration(path, await readFile(path, "utf8"), hash)), hash, path);
	assert.deepEqual(Object.keys(record.verifierPredecessors).sort(), verifierPaths);
	for(const [path, hash] of Object.entries(record.verifierPredecessors))
		assert.equal(sha256(beforeJvmSharedVerification(path, await readFile(path, "utf8"))), hash, path);
	assert.deepEqual(Object.keys(record.verifierSources).sort(), [...verifierPaths
		, "tests/helpers/jvm-shared-regression-receipt.mjs"
		, "tests/helpers/jvm-shared-verifier-updates.mjs"
		, "tests/jvm-shared-regressions.test.mjs"
	].sort());
	for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(beforeNativeSharedVerification(path, await readFile(path, "utf8"))), hash, path);
	assert.equal(record.executionsSha256, sha256(canonicalJson(record.executions)));
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.profile}`), [
		"ordinary-source/java", "ordinary-source/kotlin"
		, "reviewed-ir/java", "reviewed-ir/kotlin"
	]);
	for(const run of record.executions)
	{
		const previous = baseline.executions.find(item => item.path === run.path && item.profile === run.profile);
		same(run, previous, [
			"checks", "calls", "rejected"
			, "signaturesSha256", "observationSha256"
			, "sourceTreeSha256", "sourceApiSha256"
			, "installedFiles", "packages", "faults", "documentation"
		]);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of [
			"offline", "emptyRepository", "emptyUserHome"
			, "resolvedClasspathOnly", "installedSourcesRemoved"
			, "compilerFreeExecution", "runtimeOnlyExecution"
			, "normalExitCleanup", "repeatExecution", "localLibraries"
			, "publicApiOnly", "exactPublicSignatures"
			, "runtimeOverridesDisabled", "handoffRemovedBeforeExecution"
		])
			assert.equal(run.jvm[key], true, key);
		same(run.jvm, previous.jvm, [
			"nativeLibraries", "declarationsSha256"
			, "consumerSourceSha256", "signaturesSha256"
			, "resolvedDependencies", "runtimeModules"
			, "archiveSha256", "pomSha256"
		]);
		assert.equal(run.jvm.archiveSha256, run.packages[0].artifacts.find(item => item.path.endsWith(".jar")).sha256);
		assert.equal(run.jvm.pomSha256, run.packages[0].artifacts.find(item => item.path.endsWith(".pom")).sha256);
	}
	assert.equal(record.log.sha256, sha256(record.log.text));
	assert.match(record.log.text, /ok 1 - installed Java and Kotlin collections preserve copied values on both source paths\n/);
	assert.match(record.log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0/);
	for(const run of record.executions)
		assert.ok(record.log.text.includes(`${run.path}/${run.profile}: ${run.checks} assertions, ${run.calls} calls, ${run.rejected} rejected inputs, ${run.faults.checkpoints} injected failures`));
	return { record, baseline };
};

/**
 * Admit the four measured JVM source changes and exact verifier-only insertions.
 *
 * @param path - Historical receipt's source path.
 * @param source - Complete current source.
 * @param expected - Unchanged original source digest.
 */
export const assertJvmSharedSourceTransition = async (path, source, expected) => {
	if(verifierPaths.includes(path))
	{
		const previous = beforeJvmSharedVerification(path, source);
		if(previous !== source && sha256(previous) === expected) return true;
	}
	if(!jvmSharedProductionPaths.includes(path)) return false;
	const record = JSON.parse(await readFile(receiptPath));
	if(record.predecessors[path]?.sha256 !== expected) return false;
	await assertJvmSharedRegressionEvidence(record);
	assert.equal(sha256(source), record.sourceHashes[path], path);
	return true;
};
