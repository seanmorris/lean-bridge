/**
 * Compare fresh compiler runs with the original installed recursive packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkPhpWasmGraphPackages } from "./php-wasm-graph-packages.mjs";

/**
 * Require identical compiled artifacts, package contents and public observations.
 *
 * @param original - Original full installed-package report.
 * @param rebuilt - Independently compiled and installed package report.
 */
export const comparePhpWasmGraphBuilds = (original, rebuilt) => {
	for(const key of ["schemaVersion", "installedPackage", "compiledLean", "runtimeIdentity", "runtimeManifest"])
		assert.deepEqual(rebuilt[key], original[key], key);
	assert.deepEqual(rebuilt.observations.map(run => run.reviewed), [false, true]);
	assert.deepEqual(original.observations.map(run => run.reviewed), [false, true]);
	return rebuilt.observations.map((run, index) => {
		const before = original.observations[index];
		for(const key of ["model", "metadata", "receipt", "generatedManifest", "archives", "installedFiles", "host", "runnerSha256", "consumerSha256", "sourceSha256", "sourceUnchanged", "authorRemoved", "compilerFreeReassembly"])
			assert.deepEqual(run[key], before[key], `${run.reviewed ? "reviewed" : "ordinary"}: ${key}`);
		const calls = value => value.executions.map(item => ({ ...item, libraries: [...item.libraries].sort() }));
		assert.deepEqual(calls(run), calls(before));
		const browserCalls = value => value.browser.executions.map(({ realm, arrangement, loading, mode, observed, repeatedRequests }) => ({ realm, arrangement, loading, mode, observed, repeatedRequests }));
		assert.deepEqual(browserCalls(run), browserCalls(before));
		assert.equal(run.browser.bundleSha256, before.browser.bundleSha256);
		assert.equal(run.browser.sourceSha256, before.browser.sourceSha256);
		return { reviewed: run.reviewed, archives: run.archives
			, componentSha256: run.receipt.wasmLibrary.sha256
			, installedFilesSha256: sha256(canonicalJson(run.installedFiles))
			, nodeExecutions: run.executions.length
			, browserConfigurations: run.browser.executions.length };
	});
};

/**
 * Rebuild the runtime, both source projects and every package without a build cache.
 *
 * @param root - Empty test-owned scratch directory.
 * @param original - Verified original installed-package report.
 * @param diagnostic - Progress callback.
 */
export const checkPhpWasmGraphReproduction = async (root, original, diagnostic) => {
	const rebuilt = await checkPhpWasmGraphPackages(root, diagnostic);
	const comparisons = comparePhpWasmGraphBuilds(original, rebuilt);
	return { schemaVersion: 1
		, originalReportSha256: sha256(canonicalJson(original))
		, freshRuntime: true, freshProjects: true, freshCompilation: true
		, originalArchivesReproduced: true, comparisons, rebuilt };
};
