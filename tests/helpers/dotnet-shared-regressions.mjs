/**
 * Require original non-C# packages after admitting recursive NuGet builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const digest = value => sha256(canonicalJson(value));
const same = (actual, previous, keys) => {
	for(const key of keys) assert.deepEqual(actual[key], previous[key], key);
};
const required = (value, keys) => {
	for(const key of keys) assert.equal(value[key], true, key);
};
const installerRecord = path => /\/auto\/LeanBridge\/(?:Runtime|Recursive)\/\.packlist$/.test(path) || /\/perllocal\.pod$/.test(path);
const comparablePerl = report => ({ ...report, observations: report.observations.map(run => ({ ...run
	, installs: run.installs.map(({ installedFiles, ...rest }) => ({ ...rest
		, installedFiles: Object.fromEntries(Object.entries(installedFiles).filter(([path]) => !installerRecord(path))) })) })) });

/**
 * Keep complete JVM observations as hashes while retaining all public evidence.
 *
 * @param report - Fresh Java and Kotlin collection report.
 */
export const dotnetJvmRegressionExecutions = report => report.reports.map(({ signatures, observation, ...run }) => ({ ...run
	, signaturesSha256: digest([...signatures].sort((a, b) => a.name.localeCompare(b.name)))
	, observationSha256: digest({ results: observation.results, errors: observation.errors }) }));

/**
 * Compare original archives, native libraries and installed public behavior.
 * Only known consumer build paths and installer bookkeeping may vary.
 *
 * @param runs - Fresh non-C# installed regressions.
 * @param baselines - Original, checksummed package receipts.
 */
export const assertDotnetSharedRegressions = (runs, baselines) => {
	assert.deepEqual(Object.keys(runs).sort(), ["c", "jvm", "perl", "python", "ruby", "rust"]);
	for(const profile of ["c", "jvm", "perl", "python", "ruby", "rust"])
		assert.equal(runs[profile].environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, baselines[profile].packageGlibcFloor, `${profile} package glibc floor`);
	assert.deepEqual(runs.c.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of runs.c.executions)
	{
		const previous = baselines.c.reports.find(item => item.path === run.path && item.profile === run.profile);
		same(run, previous, ["checks", "consumerSha256", "layoutSha256", "binarySha256", "sourceTreeSha256", "installedLibraries", "rejected", "packages"]);
		required(run, ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "headersRemovedBeforeExecution"]);
		assert.equal(run.sourceFreeChecks, run.checks);
	}
	assert.deepEqual(runs.rust.executions.map(run => run.reviewed), [false, true]);
	for(const run of runs.rust.executions)
	{
		const previous = baselines.rust.report.observations.find(item => item.reviewed === run.reviewed);
		same(run, previous, ["package", "binarySha256", "layoutSha256", "checks", "checkpoints", "rejected", "publicSourceSha256", "conversionSourceSha256", "loaderSourceSha256", "compiledProjectionSha256", "consumerSourceSha256", "lockSha256", "linkerSha256", "rustc", "faultProbeSha256"]);
		same(run.documentation, previous.documentation, ["sourceSha256"]);
		same(run.composition, previous.composition, ["package", "consumerSha256", "componentCount"]);
		// The Python integration separately reproduced Cargo embedding its
		// offline vendor path in consumer executables with identical sources.
		assert.equal(baselines.pythonRegression.rustClientBuildPaths.observation.sameSources, true);
		for(const hash of [run.executableSha256, run.documentation.executableSha256, run.composition.executableSha256]) assert.match(hash, /^[a-f0-9]{64}$/);
		required(run, ["offline", "emptyCargoHome", "linkOnly", "installedSourcesRemoved", "authorSourcesRemoved", "handoffRemoved", "compilerFreeExecution", "sharedRuntime", "forkRejection", "crossCrateRetirement", "rejectsTamperedAssets", "rejectsRegeneratedSourceDrift", "deterministicReassembly"]);
	}
	assert.deepEqual(runs.python.executions, baselines.python.report.observations);
	assert.deepEqual(runs.ruby.executions, baselines.ruby.report.observations);
	assert.deepEqual(runs.jvm.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/java", "ordinary-source/kotlin", "reviewed-ir/java", "reviewed-ir/kotlin"]);
	for(const run of runs.jvm.executions)
	{
		const previous = baselines.jvm.executions.find(item => item.path === run.path && item.profile === run.profile);
		same(run, previous, ["checks", "calls", "rejected", "signaturesSha256", "observationSha256", "sourceTreeSha256", "sourceApiSha256", "installedFiles", "packages", "faults", "documentation"]);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		required(run.jvm, ["offline", "emptyRepository", "emptyUserHome", "installedSourcesRemoved", "compilerFreeExecution", "runtimeOnlyExecution", "repeatExecution", "localLibraries", "publicApiOnly", "handoffRemovedBeforeExecution"]);
		same(run.jvm, previous.jvm, ["nativeLibraries", "declarationsSha256", "consumerSourceSha256", "signaturesSha256", "resolvedDependencies", "runtimeModules"]);
	}
	const previous = baselines.perl.reports.installed, current = runs.perl.report;
	assert.deepEqual(comparablePerl(current), comparablePerl(previous));
	for(const [index, run] of current.observations.entries())
		for(const [slot, item] of run.installs.entries())
		{
			const files = previous.observations[index].installs[slot].installedFiles;
			assert.deepEqual(Object.keys(item.installedFiles), Object.keys(files));
			const bookkeeping = Object.keys(files).filter(installerRecord); assert.equal(bookkeeping.length, 3);
			for(const path of bookkeeping)
			{
				assert.match(item.installedFiles[path].sha256, /^[a-f0-9]{64}$/);
				assert.ok(Number.isSafeInteger(item.installedFiles[path].bytes) && item.installedFiles[path].bytes > 0);
			}
		}
};
