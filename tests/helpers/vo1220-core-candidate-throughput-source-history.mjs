/**
 * Preserve the Core candidate throughput repair for VO #1220.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220CoreCandidateThroughputHistoryPath
	= "docs/evidence/vo1220-core-candidate-throughput-source-history-20261109.json";
export const vo1220CoreCandidateThroughputPredecessor
	= "063869612311ac528b521d6281a5e7012d4c5ee0";
export const vo1220CoreCandidateThroughputImplementation
	= "50314df3b1ac0e0e7f0cdf4be99519685da24d22";
export const vo1220CoreCandidateThroughputCommits = Object.freeze([
	"9341d68a6ad60e2374d9adb8aafc56ae804e2809"
	, "ea00e64f9731f35a2df14f0efe4b3fc0505535dc"
	, "2278c943a0010a4ec09673cef56e92dfde92487e"
	, "4f0d3a7730e6c1bd54d4c3ac9bc31d2dd635c277"
	, "8a90d3876787853a925a7ee92c1e9a2db720ad63"
	, vo1220CoreCandidateThroughputImplementation
]);
export const vo1220CoreCandidateThroughputImplementationPaths
	= Object.freeze([
		".github/workflows/quality.yml"
		, "docs/type-surface.v1.json"
		, "scripts/core-contract-shards.mjs"
		, "scripts/core-contract-toolchains.mjs"
		, "src/adoption/test-profiles.mjs"
		, "tests/component-refinement-mirrors.test.mjs"
		, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/core-quality-budget-tests.mjs"
		, "tests/helpers/core-runner-resilience-source-history-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-npm-tests.mjs"
		, "tests/helpers/source-at-fin-history-milestone.mjs"
	]);
export const vo1220CoreCandidateThroughputImplementationAdditions
	= Object.freeze([
		"scripts/core-contract-costs.json"
		, "tests/component-nominal-subtype-history.test.mjs"
		, "tests/component-nominal-subtype.test.mjs"
		, "tests/nominal-primitive-subtype.test.mjs"
	]);
export const vo1220CoreCandidateThroughputIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220CoreCandidateThroughputHistoryAdditions = Object.freeze([
	"scripts/update-vo1220-core-candidate-throughput-source-history.mjs"
	, "tests/helpers/vo1220-core-candidate-throughput-source-history-tests.mjs"
	, "tests/helpers/vo1220-core-candidate-throughput-source-history.mjs"
]);

const historyUrl = new URL(`../../${vo1220CoreCandidateThroughputHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220CoreCandidateThroughputNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220CoreCandidateThroughputImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220CoreCandidateThroughputIntegrationPaths)
	])].sort());
const allowedPath = path =>
	vo1220CoreCandidateThroughputNormalizationPaths.includes(path);

/**
 * Reverse one authenticated Core throughput transition.
 *
 * @param source - Complete later source.
 * @param update - Exact transition for the same path.
 */
export const reverseVo1220CoreCandidateThroughputUpdate = (
	source, update
) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only the authenticated Core throughput repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220CoreCandidateThroughputSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !allowedPath(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220CoreCandidateThroughputUpdate(current, update);
	}
	return current;
};
