/**
 * Reverse the hosted zero-payload language promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadHostedPromotionHistoryPath
	= "docs/evidence/zero-payload-hosted-promotion-source-history-20261021.json";
export const zeroPayloadHostedPromotionPredecessor
	= "e434aaffaeda338c7abbb13c439466a4f7fb4a17";
export const zeroPayloadHostedPromotionImplementation
	= "8050876118e4852365ba3172dafed26c1aad9a63";
export const zeroPayloadHostedPromotionChangedPaths = Object.freeze([
	"docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/test-profiles.test.mjs"
	, "tests/type-surface.test.mjs"
]);
export const zeroPayloadHostedPromotionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadHostedPromotionHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact promotion transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadHostedPromotionUpdate = (source, update) => {
	assert.ok([...zeroPayloadHostedPromotionChangedPaths
		, ...zeroPayloadHostedPromotionIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this promotion from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadHostedPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadHostedPromotionChangedPaths
			, ...zeroPayloadHostedPromotionIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadHostedPromotionUpdate(source, update) : source;
};
