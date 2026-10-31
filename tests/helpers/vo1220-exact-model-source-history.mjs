/**
 * Preserve the complete VO #1220 exact-model audit.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ExactModelHistoryPath
	= "docs/evidence/vo1220-exact-model-source-history-20261031.json";
export const vo1220ExactModelPredecessor
	= "740375293bc549f2be2bb7d260bf3c3b69254a6a";
export const vo1220ExactModelImplementation
	= "0d7b4a48d366dc87e555b5b1dce1a627d5083565";
export const vo1220ExactModelImplementationPaths = Object.freeze([
	"tests/helpers/vo1220-zero-gap-tests.mjs"
	, "tests/helpers/vo1220-zero-gap.mjs"
]);
export const vo1220ExactModelImplementationAdditions = Object.freeze([
	"docs/evidence/vo1220-exact-type-surface-v1.json"
	, "scripts/vo1220-exact-model.mjs"
]);
export const vo1220ExactModelIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220ExactModelHistoryAdditions = Object.freeze([
	"scripts/update-vo1220-exact-model-source-history.mjs"
	, "tests/helpers/vo1220-exact-model-source-history-tests.mjs"
	, "tests/helpers/vo1220-exact-model-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + vo1220ExactModelHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220ExactModelNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220ExactModelImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => vo1220ExactModelImplementationPaths.includes(path)
	|| vo1220ExactModelIntegrationPaths.includes(path);

/**
 * Reverse one exact #1220 model transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseVo1220ExactModelUpdate = (source, update) => {
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
 * Remove only the authenticated #1220 exact-model transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeVo1220ExactModelSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !vo1220ExactModelNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ExactModelUpdate(current, update);
	}
	return current;
};
