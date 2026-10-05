/**
 * Validate the complete recursive CPAN installed-acceptance matrix.
 *
 * @file
 */
import assert from "node:assert/strict";

const configurations = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
const configuration = run => `${run.perl.replace(/^v/, "")}-${run.threaded ? "threaded" : "unthreaded"}`;
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const required = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};
const installerRecord = path => /\/auto\/LeanBridge\/(?:Runtime|Recursive)\/\.packlist$/.test(path) || /\/perllocal\.pod$/.test(path);
const comparableInstall = ({ installedFiles, ...rest }) => ({ ...rest
	, installedFiles: Object.fromEntries(Object.entries(installedFiles).filter(([path]) => !installerRecord(path))) });
const inventory = files => {
	assert.ok(Object.keys(files).length > 0);
	for(const [path, value] of Object.entries(files))
	{
		assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
		hash(value.sha256); assert.ok(Number.isSafeInteger(value.bytes) && value.bytes >= 0);
	}
};
const packages = receipt => {
	assert.equal(receipt.packages.length, 2);
	const runtime = receipt.packages.find(pkg => pkg.role === "runtime"), component = receipt.packages.find(pkg => pkg.role === "component");
	assert.ok(runtime && component); assert.equal(component.runtimeIdentity, runtime.runtimeIdentity);
	assert.deepEqual(component.requires, [{ ecosystem: "cpan", name: runtime.name, version: runtime.version }]);
	for(const pkg of [runtime, component])
	{
		assert.equal(pkg.target, "cpan"); assert.equal(pkg.ecosystem, "cpan");
		assert.equal(pkg.artifacts.length, 1); hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
	}
	return runtime;
};

/**
 * Require both source paths, all four ABIs, independent builds and real lifecycle checks.
 *
 * @param reports - Unmodified installed package, composition, collision and docs reports.
 */
export const assertPerlGraphReports = reports => {
	const { installed, composition, collision, documentation } = reports;
	for(const report of Object.values(reports)) assert.equal(report.schemaVersion, 1);
	assert.equal(installed.independentBuilds, 2);
	assert.deepEqual(installed.observations.map(run => [run.iteration, run.reviewed]), [[0, false], [0, true], [1, false], [1, true]]);
	const identities = installed.observations[0].installs.filter(run => run.mode === "prebuilt-only").map(run => run.perlSha256);
	assert.equal(new Set(identities).size, 4);
	for(const run of installed.observations)
	{
		assert.equal(run.sourceUnchanged, true); hash(run.nativeSha256); packages(run.packageSet);
		assert.equal(run.verification.deterministicReassembly, true);
		assert.deepEqual(run.verification.rejectsResignedSourceDrift, ["generated.lean", "component.h", "model.json", "symlink"]);
		assert.deepEqual(run.installs.map(item => `${configuration(item)}/${item.mode}`), configurations.flatMap(abi => ["prebuilt-only", "build-xs"].map(mode => `${abi}/${mode}`)));
		for(const installed of run.installs)
		{
			assert.equal(installed.exports, 18); assert.equal(installed.checks, installed.threaded ? 213 : 212);
			assert.equal(installed.wordBits, 64); assert.equal(installed.pointerBits, 64);
			assert.equal(installed.threadRejections, Number(installed.threaded));
			assert.equal(installed.perlSha256, identities[configurations.indexOf(configuration(installed))]);
			required(installed, ["sourceFree", "handoffRemoved", "compilerFreeExecution", "relocated", "repeated", "privateGraphSymbols"]);
			inventory(installed.installedFiles);
			const native = Object.entries(installed.installedFiles).filter(([path]) => /\/Recursive\/native\/libcomponent_[a-f0-9]+\.so$/.test(path));
			assert.equal(native.length, 1); assert.equal(native[0][1].sha256, run.nativeSha256);
			assert.equal(Object.keys(installed.installerRecords).length, 3);
			assert.deepEqual(Object.keys(installed.installerRecords), Object.keys(installed.installedFiles).filter(installerRecord));
			for(const value of Object.values(installed.installerRecords)) hash(value);
			const faults = installed.faults;
			required(faults, ["compilerFreeExecution", "installedRuntime", "isolatedXsCopy"]);
			for(const key of ["fixtureSha256", "instrumentedXsSha256", "originalXsSha256", "probeSha256"]) hash(faults[key]);
			assert.notEqual(faults.instrumentedXsSha256, faults.originalXsSha256);
			assert.deepEqual(faults.scenarios.map(item => item.mode), ["carrier", "raw", "during", "publication"]);
			for(const scenario of faults.scenarios)
				assert.deepEqual(scenario, { checks: installed.threaded ? 6445 : 6444
					, inputFailures: 84, mallocCheckpoints: 94
					, mode: scenario.mode, nativeCheckpoints: 28
					, outputFailures: 648, perl: installed.perl
					, perlCheckpoints: 732, pointerBits: 64
					, threadRejections: Number(installed.threaded)
					, threaded: installed.threaded, wordBits: 64 });
		}
	}
	for(const index of [0, 1])
	{
		const original = installed.observations[index], repeat = installed.observations[index + 2];
		for(const key of ["nativeSha256", "packages", "packageSet", "verification"]) assert.deepEqual(original[key], repeat[key], key);
		assert.deepEqual(original.installs.map(comparableInstall), repeat.installs.map(comparableInstall));
	}
	assert.equal(new Set(installed.observations.map(run => run.nativeSha256)).size, 1);
	assert.equal(composition.releases.length, 3);
	assert.equal(new Set(composition.releases.map(run => run.packages.component.id)).size, 3);
	assert.deepEqual(composition.releases[0].privateRoots, composition.releases[1].privateRoots);
	assert.equal(composition.releases[0].privateRoots.length, 2);
	const runtime = packages(composition.releases[0].packages);
	for(const release of composition.releases) assert.deepEqual(packages(release.packages), runtime);
	assert.deepEqual(composition.observations.map(run => run.perlSha256), identities);
	for(const run of composition.observations)
	{
		required(run, ["sourceFree", "handoffRemoved", "compilerFreeExecution", "relocated", "installedFilesUnchanged"]);
		inventory(run.installedFiles); hash(run.probeSha256);
		assert.deepEqual(run.reports.map(item => `${item.order}/${item.mode}`), ["acyclic-first/direct", "acyclic-first/publication", "graph-first/direct", "graph-first/publication"]);
		for(const scenario of run.reports)
		{
			assert.equal(configuration(scenario), configurations[identities.indexOf(run.perlSha256)]);
			assert.equal(scenario.checks, scenario.mode === "publication" ? 19 : 18);
			assert.equal(scenario.packageComponents, 3); assert.equal(scenario.runtimeInitRuns, 1);
			required(scenario, ["crossPackageRetirement", "forkWithBrokerLockHeld", "forkedClosureCleanup", "retainedValuesUsable"]);
		}
	}
	required(collision, ["sourceFree", "handoffRemoved", "compilerFreeExecution", "relocated", "installedFilesUnchanged"]);
	assert.equal(collision.releases.length, 2);
	assert.equal(collision.releases[0].componentId, collision.releases[1].componentId);
	assert.notEqual(collision.releases[0].nativeSha256, collision.releases[1].nativeSha256);
	assert.deepEqual(Object.keys(collision.releases[0].sources).filter(name => Object.hasOwn(collision.releases[1].sources, name)), []);
	for(const release of collision.releases) packages(release.packages);
	assert.deepEqual(collision.results.map(run => `${run.perlSha256}/${run.order.join("")}`), identities.flatMap(id => [`${id}/AB`, `${id}/BA`]));
	for(const run of collision.results)
	{
		required(run, ["rejected", "sameIdentityReload"]); assert.equal(run.openedAfterConflict, 0);
	}
	assert.deepEqual(documentation.observations.map(run => run.reviewed), [false, true]);
	for(const run of documentation.observations)
	{
		assert.equal(run.sourceUnchanged, true); packages(run.packages);
		assert.deepEqual(run.installs.map(item => item.perlSha256), identities);
		for(const item of run.installs)
		{
			required(item, ["sourceFree", "handoffRemoved", "compilerFreeExecution", "relocated", "repeated", "installedFilesRestored"]);
			assert.equal(item.documentedOutput, "41\n99\n41\n"); inventory(item.installedFiles);
			assert.equal(item.nativeTamperRejections.length, 3);
			assert.deepEqual(item.nativeTamperRejections, Object.keys(item.installedFiles).filter(path => /\/native\/[^/]+\.so$/.test(path)));
		}
	}
};
