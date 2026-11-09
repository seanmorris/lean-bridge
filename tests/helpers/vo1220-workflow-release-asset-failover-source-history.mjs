/**
 * Authenticate the complete workflow release-asset failover.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220WorkflowReleaseAssetFailoverHistoryPath
	= "docs/evidence/vo1220-workflow-release-asset-failover-source-history-20261109.json";
export const vo1220WorkflowReleaseAssetFailoverPredecessor
	= "6665af649f7e78bda200ce8fa5454e63cefab5cb";
export const vo1220WorkflowReleaseAssetFailoverImplementation
	= "260b2399fe7bc1c42ec0301a5e892e7a8fc20e5d";
export const vo1220WorkflowReleaseAssetFailoverWorkflowPaths
	= Object.freeze([
		".github/workflows/callback-checked-record-remaining.yml"
		, ".github/workflows/callback-subtype-remaining.yml"
		, ".github/workflows/checked-record-value-index-jvm.yml"
		, ".github/workflows/checked-record-value-index-wit.yml"
		, ".github/workflows/consumer-matrix.yml"
		, ".github/workflows/dependent-checked-record-jvm.yml"
		, ".github/workflows/dependent-checked-record-wit.yml"
		, ".github/workflows/generic-subtype-managed-wit.yml"
		, ".github/workflows/inherited-checked-record-jvm.yml"
		, ".github/workflows/inherited-checked-record-wit.yml"
		, ".github/workflows/nested-checked-record-jvm.yml"
		, ".github/workflows/nested-checked-record-wit.yml"
		, ".github/workflows/nominal-primitive-subtype-jvm.yml"
		, ".github/workflows/nominal-primitive-subtype-wit.yml"
		, ".github/workflows/owned-checked-record-managed.yml"
		, ".github/workflows/owned-subtype-remaining.yml"
		, ".github/workflows/recursive-checked-record-wit.yml"
		, ".github/workflows/zero-payload-checked-record-jvm.yml"
		, ".github/workflows/zero-payload-checked-record-wit.yml"
	]);
export const vo1220WorkflowReleaseAssetFailoverImplementationAddedPaths
	= Object.freeze([
		"scripts/download-pinned-release-asset.sh"
	]);
export const vo1220WorkflowReleaseAssetFailoverChangedPaths
	= Object.freeze([
		...vo1220WorkflowReleaseAssetFailoverWorkflowPaths
		, "tests/helpers/checked-record-value-index-jvm-ci-workflow-tests.mjs"
		, "tests/helpers/checked-record-value-index-jvm-ci-workflow.mjs"
		, "tests/helpers/checked-record-value-index-wit-ci-workflow-tests.mjs"
		, "tests/helpers/dependent-checked-record-jvm-ci-workflow-tests.mjs"
		, "tests/helpers/dependent-checked-record-jvm-ci-workflow.mjs"
		, "tests/helpers/dependent-checked-record-wit-ci-workflow-tests.mjs"
		, "tests/helpers/inherited-checked-record-jvm-ci-workflow-tests.mjs"
		, "tests/helpers/inherited-checked-record-jvm-ci-workflow.mjs"
		, "tests/helpers/inherited-checked-record-wit-ci-workflow-tests.mjs"
		, "tests/helpers/jvm-shard-ci-tests.mjs"
		, "tests/helpers/nested-checked-record-jvm-ci-workflow-tests.mjs"
		, "tests/helpers/nested-checked-record-jvm-ci-workflow.mjs"
		, "tests/helpers/nested-checked-record-wit-ci-workflow-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-ci-workflow-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-ci-workflow.mjs"
		, "tests/helpers/nominal-primitive-subtype-wit-ci-workflow-tests.mjs"
		, "tests/helpers/nominal-subtype-jvm-ci-workflow-tests.mjs"
		, "tests/helpers/nominal-subtype-jvm-ci-workflow.mjs"
		, "tests/helpers/nominal-subtype-wit-ci-workflow-tests.mjs"
		, "tests/helpers/owned-jvm-callback-result-ci.mjs"
		, "tests/helpers/owned-perl-callback-result-ci.mjs"
		, "tests/helpers/recursive-checked-record-wit-ci-workflow-tests.mjs"
		, "tests/helpers/wasmtime-capi-bootstrap.mjs"
		, "tests/helpers/wasmtime-capi-rollout-tests.mjs"
		, "tests/helpers/zero-payload-checked-record-jvm-ci-workflow-tests.mjs"
		, "tests/helpers/zero-payload-checked-record-jvm-ci-workflow.mjs"
		, "tests/helpers/zero-payload-checked-record-wit-ci-workflow-tests.mjs"
		, "tests/managed-ci-isolation.test.mjs"
		, "tests/multi-profile-project.test.mjs"
		, "tests/performance-ci-report.test.mjs"
	]);
export const vo1220WorkflowReleaseAssetFailoverImplementationPaths
	= Object.freeze([
		...vo1220WorkflowReleaseAssetFailoverChangedPaths
		, ...vo1220WorkflowReleaseAssetFailoverImplementationAddedPaths
	]);
export const vo1220WorkflowReleaseAssetFailoverIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220WorkflowReleaseAssetFailoverNormalizationPaths
	= Object.freeze([
		...vo1220WorkflowReleaseAssetFailoverChangedPaths
		, ...vo1220WorkflowReleaseAssetFailoverIntegrationPaths
	]);
export const vo1220WorkflowReleaseAssetFailoverHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-workflow-release-asset-failover-source-history.mjs"
		, "tests/helpers/vo1220-workflow-release-asset-failover-source-history-tests.mjs"
		, "tests/helpers/vo1220-workflow-release-asset-failover-source-history.mjs"
	]);
export const vo1220WorkflowReleaseAssetFailoverBehavior = Object.freeze({
	changedSupportCells: 0, runtimeSemanticChanges: 0
	, packageSemanticChanges: 0, measurementSemanticChanges: 0
	, releaseAssets: 2, checksummedAssets: 2, uncheckedAssets: 0
	, workflowFiles: 19, workflowCallSites: 35, directBrowserUrlsAfter: 0
	, pinnedApiRoutes: 2
});

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220WorkflowReleaseAssetFailoverHistoryPath, "utf8"
));

/**
 * Require the shared identities and every current workflow call site.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220WorkflowReleaseAssetFailover = sources => {
	for(const path of vo1220WorkflowReleaseAssetFailoverImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const helper = sources["scripts/download-pinned-release-asset.sh"];
	for(const pin of [
		"https://github.com/JetBrains/kotlin/releases/download/v2.2.0/kotlin-compiler-2.2.0.zip"
		, "https://api.github.com/repos/JetBrains/kotlin/releases/assets/266479493"
		, "1adb6f1a5845ba0aa5a59e412e44c8e405236b957de1a9683619f1dca3b16932"
		, "https://github.com/bytecodealliance/wasmtime/releases/download/v42.0.1/wasmtime-v42.0.1-x86_64-linux-c-api.tar.xz"
		, "https://api.github.com/repos/bytecodealliance/wasmtime/releases/assets/362397783"
		, "2097a47351918a446b26c7e65f487278f63bc947591b71897db547cd90c05082"
	]) assert.ok(helper.includes(pin), pin);
	assert.match(helper, /--header 'Accept: application\/octet-stream'/u);
	assert.match(helper, /sha256sum --check --status/u);
	assert.match(helper, /mv -f -- "\$partial" "\$destination"/u);
	const workflows = vo1220WorkflowReleaseAssetFailoverWorkflowPaths
		.map(path => sources[path]).join("\n");
	assert.doesNotMatch(workflows
		, /github\.com\/.+\/releases\/download\//u);
	assert.equal(workflows.split(
		"bash scripts/download-pinned-release-asset.sh kotlin-compiler"
	).length - 1, 17);
	assert.equal(workflows.split(
		"bash scripts/download-pinned-release-asset.sh wasmtime-c-api"
	).length - 1, 18);
	assert.match(sources["tests/performance-ci-report.test.mjs"]
		, /every direct workflow release asset uses one checksummed API failover/u);
	assert.match(sources["tests/helpers/wasmtime-capi-bootstrap.mjs"]
		, /download-pinned-release-asset\.sh wasmtime-c-api/u);
	return { ...vo1220WorkflowReleaseAssetFailoverBehavior };
};

/**
 * Reverse one authenticated workflow failover transition.
 *
 * @param source - Exact later source.
 * @param update - Recorded transition for the same path.
 */
export const reverseVo1220WorkflowReleaseAssetFailoverUpdate = (
	source, update
) => {
	assert.ok(vo1220WorkflowReleaseAssetFailoverNormalizationPaths
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this workflow failover and its registration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220WorkflowReleaseAssetFailoverSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220WorkflowReleaseAssetFailoverNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220WorkflowReleaseAssetFailoverUpdate(
				current, update);
	}
	return current;
};
