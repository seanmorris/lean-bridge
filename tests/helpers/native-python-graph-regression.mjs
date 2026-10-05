/**
 * Keep earlier receipts immutable while requiring fresh Python-branch builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertRubyGraphSourceUpdate } from "./native-ruby-graph-regression.mjs";
import { beforeNativeTargetVerification } from "./native-shared-verifier-updates.mjs";

const recordPath = "docs/evidence/python-recursive-regressions-20260923.json";
const shared = ["src/build/native-project.mjs", "src/build/native-c-projection.mjs", "src/build/native-graph-projection.mjs"];
const digest = value => sha256(canonicalJson(value));
const same = (run, previous, keys) => {
	for(const key of keys) assert.deepEqual(run[key], previous[key], key);
};

/** Verify independently recorded installations against the previous releases. */
export const assertPythonGraphRegressions = async () => {
	const record = JSON.parse(await readFile(recordPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertRubyGraphSourceUpdate(path, hash);
	const baselines = {};
	for(const [key, entry] of Object.entries(record.baselines))
	{
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256);
		baselines[key] = JSON.parse(bytes);
	}
	for(const entry of Object.values(record.runs))
	{
		assert.equal(sha256(entry.log.text), entry.log.sha256);
		assert.match(entry.log.text, /# pass [12]\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0/);
		assert.equal(digest(entry.executions), entry.executionsSha256);
	}
	assert.deepEqual(record.runs.c.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of record.runs.c.executions)
	{
		const previous = baselines.c.reports.find(item => item.path === run.path && item.profile === run.profile);
		same(run, previous, ["checks", "consumerSha256", "layoutSha256", "binarySha256", "sourceTreeSha256", "installedLibraries", "rejected", "packages"]);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "headersRemovedBeforeExecution"])
			assert.equal(run[key], true, key);
		assert.equal(run.sourceFreeChecks, run.checks);
	}
	assert.deepEqual(record.runs.jvm.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const run of record.runs.jvm.executions)
	{
		const previous = baselines.jvm.executions.find(item => item.path === run.path && item.profile === run.profile);
		same(run, previous, ["checks", "calls", "rejected", "signaturesSha256", "observationSha256", "sourceTreeSha256", "sourceApiSha256", "installedFiles", "packages", "faults"]);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const key of ["offline", "emptyRepository", "emptyUserHome", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "repeatExecution", "localLibraries", "publicApiOnly", "handoffRemovedBeforeExecution"])
			assert.equal(run.jvm[key], true, key);
		same(run.jvm, previous.jvm, ["nativeLibraries", "declarationsSha256", "consumerSourceSha256", "signaturesSha256", "resolvedDependencies", "runtimeModules"]);
	}
	assert.deepEqual(record.runs.rust.executions.map(run => run.reviewed), [false, true]);
	for(const run of record.runs.rust.executions)
	{
		const previous = baselines.rust.report.observations.find(item => item.reviewed === run.reviewed);
		same(run, previous, ["package", "binarySha256", "layoutSha256", "checks", "checkpoints", "rejected", "publicSourceSha256", "conversionSourceSha256", "loaderSourceSha256", "compiledProjectionSha256", "consumerSourceSha256", "lockSha256", "linkerSha256", "rustc", "faultProbeSha256"]);
		assert.equal(run.documentation.sourceSha256, previous.documentation.sourceSha256);
		same(run.composition, previous.composition, ["package", "consumerSha256", "componentCount"]);
		// Publisher archives reproduce exactly. Client executables retain the
		// offline vendor directory in Rust source locations, as the probe proves.
		for(const hash of [run.executableSha256, run.documentation.executableSha256, run.composition.executableSha256])
			assert.match(hash, /^[a-f0-9]{64}$/);
		for(const key of ["offline", "emptyCargoHome", "linkOnly", "installedSourcesRemoved", "authorSourcesRemoved", "handoffRemoved", "compilerFreeExecution", "sharedRuntime", "forkRejection", "crossCrateRetirement", "rejectsTamperedAssets", "rejectsRegeneratedSourceDrift", "deterministicReassembly"])
			assert.equal(run[key], true, key);
	}
	const probe = record.rustClientBuildPaths;
	assert.equal(sha256(probe.source), probe.sourceSha256);
	assert.equal(digest(probe.observation), probe.observationSha256);
	assert.equal(probe.observation.sameSources, true); assert.equal(probe.observation.sameCompiler, true);
	assert.deepEqual(probe.observation.runs.map(run => run.directory), ["first", "second"]);
	const [first, second] = probe.observation.runs;
	assert.notEqual(first.binarySha256, second.binarySha256);
	assert.deepEqual(first.metadata, second.metadata); assert.equal(first.metadata.length, 2);
	for(const run of probe.observation.runs)
	{
		assert.equal(run.embeddedRoot, true);
		assert.equal(run.output, `<test-root>/${run.directory}/vendor/api/src/lib.rs\n`);
	}
	assert.deepEqual(record.runs.pythonCollections.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs.pythonCollections.executions)
	{
		const previous = baselines.pythonCollections.executions.find(item => item.path === run.path);
		same(run, previous, ["sourceTreeSha256", "sourceApiSha256"]);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		assert.equal(run.installations.length, 3);
		for(const item of run.installations)
		{
			const old = previous.installations.find(entry => entry.name === item.name);
			same(item, old, ["faults", "strictTypecheck", "dependency", "requires", "installedDependency", "sourceHashes"]);
			const { loadedLibraries: currentLibraries, ...observed } = item.public;
			const { loadedLibraries: originalLibraries, ...original } = old.public;
			assert.deepEqual(observed, original);
			assert.deepEqual(currentLibraries.map(value => value.path), originalLibraries.map(value => value.path));
			for(const { path, ...identity } of currentLibraries) assert.deepEqual(identity, item.installedFiles[path]);
			for(const path of ["lean_collections/__init__.py", "lean_collections/__init__.pyi"])
				assert.deepEqual(item.installedFiles[path], old.installedFiles[path]);
			for(const key of ["offlineInstall", "resolvedOffline", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "repeatExecution", "installedFilesUnchanged", "installedDependencyUnchanged", "isolatedInMemoryFaultProbe"])
				assert.equal(item[key], true, key);
		}
	}
	assert.deepEqual(record.runs.pythonCallables.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs.pythonCallables.executions)
	{
		const previous = baselines.pythonCallables.executions.find(item => item.path === run.path);
		same(run, previous, ["checks", "consumerSha256", "sourceTreeSha256"]);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"])
			assert.equal(run[key], true, key);
	}
	return { record, baselines };
};

const restoreVerification = (source, path) => {
	const rust = path === "tests/rust-graph-package.test.mjs";
	const replacements = rust ? [
		['import { assertPythonGraphSourceUpdate } from "./helpers/native-python-graph-regression.mjs";\n', 'import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";\n']
		, ['await assertPythonGraphSourceUpdate(path, hash);', 'await assertAdministrativeSourceUpdate(path, hash);']
		, ['\tassert.equal(compileNativeGraphProjection(ir, ["cargo", "pypi"]).layoutSha256, model.layoutSha256);\n', ""]
		, ['[[], ["cargo", "cargo"], ["cargo", "cpan"], ["maven"]]', '[[], ["cargo", "cargo"], ["cargo", "pypi"], ["cargo", "cpan"], ["maven"]]']
	] : [
		['import { assertPythonGraphSourceUpdate } from "./native-python-graph-regression.mjs";\n', ""]
		, ['await assertPythonGraphSourceUpdate(path, hash);', 'await assertAdministrativeSourceUpdate(path, hash);']
		, ['await assertPythonGraphSourceUpdate(path, record.sourceHashes[path]);', 'assert.equal(sha256(source), record.sourceHashes[path], path);']
	];
	for(const [current, previous] of replacements)
	{
		assert.equal(source.split(current).length, 2, "Exactly one explicit Python-branch regression-verification edit");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Require original source identities or fresh, independently checked regressions.
 *
 * @param path - Historical source path.
 * @param expected - Immutable receipt digest.
 */
export const assertPythonGraphSourceUpdate = async (path, expected) => {
	const source = beforeNativeTargetVerification(path, await readFile(path, "utf8"));
	if(sha256(source) === expected) return;
	if(["tests/rust-graph-package.test.mjs", "tests/helpers/native-cargo-graph-regression.mjs"].includes(path))
	{
		assert.equal(sha256(restoreVerification(source, path)), expected, path); return;
	}
	if(!shared.includes(path)) return assertRubyGraphSourceUpdate(path, expected);
	const { record, baselines } = await assertPythonGraphRegressions();
	assert.ok(Object.values(baselines).some(item => item.sourceHashes?.[path] === expected), `Unknown shared build baseline: ${path}`);
	await assertRubyGraphSourceUpdate(path, record.sourceHashes[path]);
};
