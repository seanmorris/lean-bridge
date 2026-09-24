/**
 * Preserve historical native receipts while checking fresh Cargo-branch builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";
import { assertPythonGraphSourceUpdate } from "./native-python-graph-regression.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const recordPath = "docs/evidence/rust-recursive-regressions-20260923.json";
const shared = ["src/build/native-project.mjs", "src/build/native-c-projection.mjs"];
const digest = value => sha256(canonicalJson(value));

/** Verify fresh installations and unchanged public observations against baselines. */
export const assertCargoGraphRegressions = async () => {
	const record = JSON.parse(await readFile(recordPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	for(const [path, hash] of Object.entries(record.sourceHashes))
		await assertPythonGraphSourceUpdate(path, hash);
	const baselines = {};
	for(const [key, entry] of Object.entries(record.baselines))
	{
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256);
		baselines[key] = JSON.parse(bytes);
	}
	for(const entry of Object.values(record.runs))
	{
		assert.equal(sha256(entry.log.text), entry.log.sha256);
		assert.match(entry.log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0/);
		assert.equal(digest(entry.executions), entry.executionsSha256);
	}
	assert.deepEqual(record.runs.c.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of record.runs.c.executions)
	{
		const previous = baselines.c.reports.find(item => item.path === run.path && item.profile === run.profile);
		for(const key of ["checks", "consumerSha256", "layoutSha256", "binarySha256", "sourceTreeSha256", "installedLibraries", "rejected"])
			assert.deepEqual(run[key], previous[key], key);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "headersRemovedBeforeExecution"])
			assert.equal(run[key], true, key);
		assert.equal(run.sourceFreeChecks, run.checks);
		assert.deepEqual(run.packages, previous.packages);
	}
	assert.deepEqual(record.runs.jvm.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const run of record.runs.jvm.executions)
	{
		const previous = baselines.jvm.executions.find(item => item.path === run.path && item.profile === run.profile);
		for(const key of ["checks", "calls", "rejected", "signaturesSha256", "observationSha256", "sourceTreeSha256", "sourceApiSha256", "installedFiles", "packages"])
			assert.deepEqual(run[key], previous[key], key);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "resolvedClasspathOnly", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "normalExitCleanup", "repeatExecution", "localLibraries", "publicApiOnly", "exactPublicSignatures", "runtimeOverridesDisabled", "handoffRemovedBeforeExecution"])
			assert.equal(run.jvm[key], true, key);
		for(const key of ["nativeLibraries", "declarationsSha256", "consumerSourceSha256", "signaturesSha256", "resolvedDependencies", "runtimeModules"])
			assert.deepEqual(run.jvm[key], previous.jvm[key], key);
		assert.deepEqual(run.faults, previous.faults);
	}
	for(const group of ["rustCollections"])
	{
		const entries = record.runs[group].executions, previous = baselines[group].executions ?? baselines[group].reports;
		assert.deepEqual(entries.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
		for(const run of entries)
		{
			const old = previous.find(item => item.path === run.path);
			for(const [key, value] of Object.entries(run.observations)) assert.deepEqual(value, old[key], `${group}/${key}`);
			assert.equal(run.sourceRemovedBeforeInstallation, true);
			assert.equal(run.compilerFreeExecution, true);
			assert.equal(run.installedSourcesRemoved, true);
			assert.equal(run.publicSourceSha256, old.installedFiles["src/lib.rs"].sha256);
			assert.equal(run.conversionSourceSha256, old.installedFiles["src/__runtime.rs"].sha256);
			assert.equal(run.packages[0].runtimeDelivery, "embedded");
		}
	}
	assert.deepEqual(record.runs.rustCallables.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs.rustCallables.executions)
	{
		const previous = baselines.rustCallables.executions.find(item => item.path === run.path);
		for(const key of ["checks", "consumerSha256", "sourceTreeSha256", "offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"])
			assert.deepEqual(run[key], previous[key], key);
		for(const key of ["rejected", "faultSourceSha256", "faultTests", "sourceFreeChecks"])
			assert.deepEqual(run.safety[key], previous.safety[key], key);
		assert.equal(run.packages[0].runtimeDelivery, "embedded");
	}
	return { record, baselines };
};

const restoreVerification = (source, path) => {
	const replacements = path === "tests/native-graph-package.test.mjs" ? [
		['import { assertCargoGraphSourceUpdate } from "./helpers/native-cargo-graph-regression.mjs";\n', ""]
		, ['for(const [path, hash] of Object.entries(record.sourceHashes)) await assertCargoGraphSourceUpdate(path, hash);', 'for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);']
	] : [
		['import { assertCargoGraphSourceUpdate } from "./native-cargo-graph-regression.mjs";\n', ""]
		, ['for(const [path, hash] of Object.entries(regression.sourceHashes)) await assertCargoGraphSourceUpdate(path, hash);', 'for(const [path, hash] of Object.entries(regression.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);']
		, ['assert.equal(sha256(await readFile(path)), lineage.sources[path].currentSha256);', 'assert.equal(regression.sourceHashes[path], lineage.sources[path].currentSha256);']
	];
	for(const [current, previous] of replacements)
	{
		assert.equal(source.split(current).length, 2, "Exactly one explicit regression-verification edit");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Accept changed shared build code only with current installed regression evidence.
 *
 * @param path - File recorded in an immutable C/C++ or JVM receipt.
 * @param expected - Original receipt's SHA-256, never replaced in that receipt.
 */
export const assertCargoGraphSourceUpdate = async (path, expected) => {
	const source = beforeWitPackageIntegration(path, await readFile(path, "utf8"), expected);
	if(sha256(source) === expected) return;
	if(["tests/native-graph-package.test.mjs", "tests/helpers/native-graph-jvm-regression.mjs"].includes(path))
	{
		assert.equal(sha256(restoreVerification(source, path)), expected, path);
		return;
	}
	if(!shared.includes(path)) return assertAdministrativeSourceUpdate(path, expected);
	const { record, baselines } = await assertCargoGraphRegressions();
	assert.ok([baselines.c, baselines.jvm].some(item => item.sourceHashes[path] === expected), `Unknown native build baseline: ${path}`);
	await assertPythonGraphSourceUpdate(path, record.sourceHashes[path]);
};
