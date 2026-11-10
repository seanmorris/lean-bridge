/**
 * Authenticate the live documentation-pin completion that follows the Node
 * consumer timeout epoch split.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220NodeConsumerTimeoutPinCompletionHistoryPath
	= "docs/evidence/vo1220-node-consumer-timeout-pin-completion-source-history-20261110.json";
export const vo1220NodeConsumerTimeoutPinCompletionPredecessor
	= "8c8a60ebfe39d7944db3605799c3194ad7947753";
export const vo1220NodeConsumerTimeoutPinCompletionImplementation
	= "fdce9d0c1f8b05203c7d68e4fa6da3cbf47edefe";
export const vo1220NodeConsumerTimeoutPinCompletionCommits = Object.freeze([
	vo1220NodeConsumerTimeoutPinCompletionImplementation
]);
export const vo1220NodeConsumerTimeoutPinCompletionImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const vo1220NodeConsumerTimeoutPinCompletionIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220NodeConsumerTimeoutPinCompletionHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-node-consumer-timeout-pin-completion-source-history.mjs"
		, "tests/helpers/vo1220-node-consumer-timeout-pin-completion-source-history-tests.mjs"
		, "tests/helpers/vo1220-node-consumer-timeout-pin-completion-source-history.mjs"
	]);
export const vo1220NodeConsumerTimeoutPinCompletionBehavior = Object.freeze({
	currentSourcePaths: 1, refreshedPins: 25, changedSupportCells: 0
	, runtimeSemanticChanges: 0, packageSemanticChanges: 0
	, productionCodeChanges: 0
});

export const vo1220NodeConsumerTimeoutPinCompletionPreviousSha256
	= "bb27632995ffa69c1cf3ad2809ce4254033db7ecdf85717f47f46a9bb7a26891";
export const vo1220NodeConsumerTimeoutPinCompletionCurrentSha256
	= "fc5bb2ed4b90385c8e96d2d96b84519e190ba62d913f75017f4b5e82c44efb4a";

const historyUrl = new URL(
	`../../${vo1220NodeConsumerTimeoutPinCompletionHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220NodeConsumerTimeoutPinCompletionNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220NodeConsumerTimeoutPinCompletionImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220NodeConsumerTimeoutPinCompletionIntegrationPaths)
	])].sort());
const allowedPath = path =>
	vo1220NodeConsumerTimeoutPinCompletionNormalizationPaths.includes(path);

/**
 * Require exactly the 25 documentation-test pins at their live digest.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220NodeConsumerTimeoutPinCompletion = sources => {
	const inventory = JSON.parse(sources["docs/type-surface.v1.json"]);
	const pins = inventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === "tests/documentation.test.mjs");
	assert.equal(pins.length, 25);
	assert.ok(pins.every(file =>
		file.sha256 === vo1220NodeConsumerTimeoutPinCompletionCurrentSha256));
	return { ...vo1220NodeConsumerTimeoutPinCompletionBehavior };
};

/**
 * Reverse one authenticated pin-completion transition.
 *
 * @param source - Exact later source.
 * @param update - Exact transition for the same path.
 */
export const reverseVo1220NodeConsumerTimeoutPinCompletionUpdate = (
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
 * Remove only the authenticated pin completion and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220NodeConsumerTimeoutPinCompletionSource = (
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
			current = reverseVo1220NodeConsumerTimeoutPinCompletionUpdate(
				current, update);
	}
	return current;
};
