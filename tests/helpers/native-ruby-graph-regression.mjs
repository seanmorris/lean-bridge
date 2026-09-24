/**
 * Preserve earlier release receipts and verify the Ruby graph build transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";
import { beforeNativeTargetVerification } from "./native-shared-verifier-updates.mjs";

const recordPath = "docs/evidence/ruby-recursive-regressions-20260923.json";
const shared = ["src/build/native-project.mjs", "src/build/native-c-projection.mjs", "src/build/native-graph-projection.mjs"];
const digest = value => sha256(canonicalJson(value));
const same = (run, previous, keys) => {
	for(const key of keys) assert.deepEqual(run[key], previous[key], key);
};

/** Check original packages and current installed consumers against prior receipts. */
export const assertRubyGraphRegressions = async () => {
	const record = JSON.parse(await readFile(recordPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	const baselines = {};
	for(const [key, entry] of Object.entries(record.baselines))
	{
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256);
		baselines[key] = JSON.parse(bytes);
	}
	for(const entry of [...Object.values(record.runs), record.beforeRubyIntegration])
	{
		assert.equal(sha256(entry.log.text), entry.log.sha256);
		assert.match(entry.log.text, /# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0/);
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
		// Rust records offline vendor paths in client executables. The preceding
		// Python regression receipt retains the isolated reproduction of this.
		assert.equal(baselines.pythonRegression.rustClientBuildPaths.observation.sameSources, true);
		for(const hash of [run.executableSha256, run.documentation.executableSha256, run.composition.executableSha256])
			assert.match(hash, /^[a-f0-9]{64}$/);
		for(const key of ["offline", "emptyCargoHome", "linkOnly", "installedSourcesRemoved", "authorSourcesRemoved", "handoffRemoved", "compilerFreeExecution", "sharedRuntime", "forkRejection", "crossCrateRetirement", "rejectsTamperedAssets", "rejectsRegeneratedSourceDrift", "deterministicReassembly"])
			assert.equal(run[key], true, key);
	}
	assert.deepEqual(record.runs.python.executions, baselines.python.report.observations);
	assert.match(record.beforeRubyIntegration.revision, /^[a-f0-9]{40}$/);
	assert.deepEqual(record.beforeRubyIntegration.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(record.runs.rubyCollections.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs.rubyCollections.executions)
	{
		const original = baselines.rubyCollections.executions.find(item => item.path === run.path);
		const previous = record.beforeRubyIntegration.executions.find(item => item.path === run.path);
		same(run, original, ["checks", "calls", "rejected", "consumerSha256", "probeSha256", "sourceTreeSha256", "sourceApiSha256", "signaturesSha256", "faults"]);
		same(run, previous, ["nativeLibraries", "bindingIrSha256", "modelSha256"]);
		assert.deepEqual(Object.keys(run.installedFiles), Object.keys(previous.installedFiles));
		const changed = Object.keys(run.installedFiles).filter(path => digest(run.installedFiles[path]) !== digest(previous.installedFiles[path]));
		assert.deepEqual(changed, ["lib/lean_bridge/collections/native.rb", "lib/lean_bridge/native_copied_runtime_v1.rb"]);
		assert.equal(run.installedFiles["lib/lean_bridge/collections.rb"].sha256, original.installedFiles["lib/lean_bridge/collections.rb"].sha256);
		for(const key of ["offlineInstall", "compilerFreeExecution", "sourceRemovedBeforeInstallation", "relocatedInstallation", "producerHandoffRemoved", "gemCacheRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe"])
			assert.equal(run[key], true, key);
		assert.equal(run.packages[0].runtimeIdentity, previous.packages[0].runtimeIdentity);
		assert.notEqual(run.packages[0].artifacts[0].sha256, previous.packages[0].artifacts[0].sha256);
	}
	assert.deepEqual(record.runs.rubyCallables.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs.rubyCallables.executions)
	{
		const previous = baselines.rubyCallables.executions.find(item => item.path === run.path);
		same(run, previous, ["checks", "consumerSha256", "sourceTreeSha256"]);
		for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"])
			assert.equal(run[key], true, key);
	}
	return { record, baselines };
};

const restoreVerification = (source, path) => {
	const helper = path === "tests/helpers/native-python-graph-regression.mjs";
	const location = helper ? "./" : "./helpers/";
	const replacements = [
		[`import { assertRubyGraphSourceUpdate } from "${location}native-ruby-graph-regression.mjs";\n`, `import { assertAdministrativeSourceUpdate } from "${location}test-registration-history.mjs";\n`]
		, ["await assertRubyGraphSourceUpdate(path, hash);", "await assertAdministrativeSourceUpdate(path, hash);"]
		, ...helper ? [
			["return assertRubyGraphSourceUpdate(path, expected);", "return assertAdministrativeSourceUpdate(path, expected);"]
			, ["await assertRubyGraphSourceUpdate(path, record.sourceHashes[path]);", "assert.equal(sha256(source), record.sourceHashes[path], path);"]
		] : [
			['\tassert.equal(compileNativeGraphProjection(ir, ["pypi", "rubygems"]).layoutSha256, model.layoutSha256);\n', ""]
			, ['[[], ["pypi", "pypi"], ["pypi", "cpan"], ["pypi", "maven"]]', '[[], ["pypi", "pypi"], ["pypi", "cpan"], ["pypi", "maven"], ["rubygems"]]']
		]
	];
	for(const [current, previous] of replacements)
	{
		assert.equal(source.split(current).length, 2, "Exactly one explicit Ruby-branch verification edit");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Require exact historical bytes or separately validated installed regressions.
 *
 * @param path - Source path from an immutable receipt.
 * @param expected - Original SHA-256, never replaced in that receipt.
 */
export const assertRubyGraphSourceUpdate = async (path, expected) => {
	const source = beforeNativeTargetVerification(path, await readFile(path, "utf8"));
	if(sha256(source) === expected) return;
	if(["tests/python-graph-package.test.mjs", "tests/helpers/native-python-graph-regression.mjs"].includes(path))
	{
		assert.equal(sha256(restoreVerification(source, path)), expected, path); return;
	}
	if(!shared.includes(path)) return assertAdministrativeSourceUpdate(path, expected);
	const { record, baselines } = await assertRubyGraphRegressions();
	assert.ok(Object.values(baselines).some(item => item.sourceHashes?.[path] === expected), `Unknown shared build baseline: ${path}`);
	await assertAdministrativeSourceUpdate(path, record.sourceHashes[path]);
};
