/**
 * Reverse the exact frozen-promotion documentation replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const promotionDocMilestoneReplayRepairHistoryPath
	= "docs/evidence/promotion-doc-milestone-replay-repair-source-history-20261023.json";
export const promotionDocMilestoneReplayRepairPredecessor
	= "84dae9e40fbd3477cd7b383c97811bd7cc1b8194";
export const promotionDocMilestoneReplayRepairImplementation
	= "0f1ede6171a331821e54451efbcd98d3a2b2b2ef";
export const promotionDocMilestoneReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/checked-record-native-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-php-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-dotnet-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-promotion-tests.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-subtype-promotion-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-promotion-tests.mjs"
]);
export const promotionDocMilestoneReplayRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/nested-checked-records.test.mjs"
]);
export const promotionDocMilestoneReplayRepairNormalizationPaths = Object.freeze([
	...promotionDocMilestoneReplayRepairChangedPaths
	, ...promotionDocMilestoneReplayRepairIntegrationPaths
]);
export const promotionDocMilestoneReplayRepairAddedPaths = Object.freeze([
	"scripts/update-promotion-doc-milestone-replay-repair-source-history.mjs"
	, "tests/helpers/promotion-doc-milestone-replay-repair-source-history-tests.mjs"
	, "tests/helpers/promotion-doc-milestone-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	promotionDocMilestoneReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePromotionDocMilestoneReplayRepairUpdate = (source, update) => {
	assert.ok(promotionDocMilestoneReplayRepairNormalizationPaths
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact frozen-promotion documentation replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePromotionDocMilestoneReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !promotionDocMilestoneReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reversePromotionDocMilestoneReplayRepairUpdate(source, update)
		: source;
};
