/**
 * Verify original NuGet graph installations, independent builds and composition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const required = (value, keys) => {
	for(const key of keys) assert.equal(value[key], true, key);
};
const files = inventory => {
	assert.ok(Object.keys(inventory).length > 0);
	for(const [path, file] of Object.entries(inventory))
	{
		assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
	}
};
const packageEntry = pkg => {
	assert.equal(pkg.target, "nuget"); assert.equal(pkg.ecosystem, "nuget");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1); hash(pkg.artifacts[0].sha256);
	assert.ok(pkg.artifacts[0].bytes > 0); hash(pkg.runtimeIdentity);
};

/**
 * Check the whole installed acceptance matrix without relying on summary flags.
 *
 * @param reports - Unmodified installed, reproduction, composition and conflict reports.
 */
export const assertDotnetGraphPackageReports = reports => {
	assert.deepEqual(Object.keys(reports).sort(), ["composition", "conflicts", "packages", "reproducibility"]);
	const { packages, reproducibility, composition, conflicts } = reports;
	assert.equal(packages.schemaVersion, 1); assert.equal(packages.installedPackage, true);
	assert.equal(reproducibility.schemaVersion, 1);
	assert.equal(reproducibility.originalReportSha256, sha256(canonicalJson(packages)));
	assert.deepEqual(packages.observations.map(run => run.reviewed), [false, true]);
	assert.deepEqual(reproducibility.observations.map(run => run.reviewed), [false, true]);
	for(const run of packages.observations)
	{
		assert.equal(run.exports, 18); assert.equal(run.checks, 685); assert.equal(run.concurrentCalls, 256);
		assert.equal(run.sourceFreeExecutions, 2); assert.equal(run.tamperRejections, 4);
		assert.equal(run.rejectsGraphReceiptDrift, 3); assert.equal(run.rejectsRegeneratedSourceDrift, 3);
		required(run, ["checkedSourceUnchanged", "deploymentUnchanged", "deterministicReassembly", "emptyNuGetCache", "installedFilesUnchanged", "nugetOnly", "offlineInstall", "onlyPreparedDependency", "sdkFreeExecution"]);
		for(const key of ["archiveSha256", "binarySha256", "bindingIrSha256", "installedReceiptSha256", "layoutSha256", "modelSha256", "publicCallerSha256"]) hash(run[key]);
		files(run.installedFiles); files(run.deployment);
		assert.deepEqual(run.nativeLibraries, Object.keys(run.deployment).filter(path => path.endsWith(".so")));
		assert.equal(run.nativeLibraries.length, 4);
		for(const path of run.nativeLibraries) assert.deepEqual(run.deployment[path], run.installedFiles[path]);
		const component = run.nativeLibraries.find(path => /\/libcomponent_[a-f0-9]+\.so$/.test(path));
		assert.ok(component); assert.equal(run.deployment[component].sha256, run.binarySha256);
		const types = run.publicTypes;
		assert.equal(types.assemblySha256, run.installedFiles["lib/net8.0/LeanBridge.Recursive.dll"].sha256);
		assert.equal(types.sdk, "8.0.424"); hash(types.compilerSha256);
		assert.deepEqual(types.rejected.map(item => item.name), ["input-type", "result-type", "array-elements", "abstract-case", "init-only", "unit-result", "private-ffi", "transparent-alias"]);
		for(const item of types.rejected)
		{ hash(item.sourceSha256); assert.match(item.code, /^CS\d{4}$/); }
		required(run.documentation, ["deploymentUnchanged", "sdkFreeExecution", "sourceFreeExecution"]);
		assert.equal(run.documentation.stdout, "True\nFalse\nTrue\nTrue\n3\n"); hash(run.documentation.sourceSha256);
		const repeated = reproducibility.observations.find(item => item.reviewed === run.reviewed);
		assert.equal(repeated.exactOriginalArchive, true);
		for(const key of ["archiveSha256", "binarySha256", "bindingIrSha256", "modelSha256"]) assert.equal(repeated[key], run[key], key);
	}
	assert.equal(packages.observations[0].binarySha256, packages.observations[1].binarySha256);
	assert.equal(packages.observations[0].layoutSha256, packages.observations[1].layoutSha256);
	required(composition, ["deploymentUnchanged", "mixedCppNuget", "sdkFreeExecution", "sharedRetirement", "sourceFreeExecution"]);
	assert.equal(composition.packages.length, 3); assert.equal(composition.receipts.length, 3);
	assert.deepEqual(composition.packages.map(pkg => pkg.graph), [true, true, false]);
	assert.equal(new Set(composition.packages.map(pkg => pkg.name)).size, 3);
	assert.equal(new Set(composition.packages.map(pkg => pkg.runtimeIdentity)).size, 1);
	for(const pkg of composition.packages)
	{
		packageEntry(pkg);
		const receipt = composition.receipts.find(item => item.name === pkg.name);
		assert.ok(receipt); hash(receipt.sha256); files(receipt.files);
	}
	assert.deepEqual(composition.scenarios, [
		{ concurrentCalls: 192, mode: "graph-first", stdout: "composition-ok:graph-first:9\n" }
		, { concurrentCalls: 192, mode: "peer-first", stdout: "composition-ok:peer-first:10\n" }
	]);
	hash(composition.sourceSha256);
	required(conflicts, ["deploymentsUnchanged", "earlierPackageSurvivesConflict", "originalArchives", "rejectsBeforeComponentLoad", "sdkFreeExecution", "sourceFreeExecution"]);
	assert.deepEqual(conflicts.packages.map(pkg => pkg.value), [41, 43]);
	const [first, second] = conflicts.packages;
	assert.equal(first.componentId, "graph_collision@1.0.0"); assert.equal(second.componentId, first.componentId);
	assert.equal(first.componentLibrary, second.componentLibrary); assert.notEqual(first.receiptSha256, second.receiptSha256);
	const componentPath = `runtimes/linux-x64/native/${first.componentLibrary}`;
	assert.notEqual(first.deployment[componentPath], second.deployment[componentPath]);
	for(const pkg of conflicts.packages)
	{
		packageEntry(pkg.pkg); files(pkg.files); hash(pkg.receiptSha256); hash(pkg.sourceSha256);
		assert.equal(pkg.deployment[componentPath], pkg.files[componentPath].sha256);
	}
	assert.deepEqual(conflicts.scenarios, [41, 43].flatMap(first =>
		["conflict", "duplicate"].map(mode => ({ first, mode
			, second: mode === "duplicate" ? first : 84 - first
			, stdout: `coordinate-ok:${mode}:${first}\n` }))));
	hash(conflicts.probeSha256);
};
