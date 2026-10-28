/**
 * Reverse the hosted zero-payload PHP-Wasm promotion milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadPhpWasmPromotionHistoryPath
	= "docs/evidence/zero-payload-php-wasm-promotion-source-history-20261021.json";
export const zeroPayloadPhpWasmPromotionPredecessor
	= "0d221f8c3aafe9d7e2a2a4bde7395e7fc5e779b7";
export const zeroPayloadPhpWasmPromotionImplementation
	= "51fc02e9aee8cd0511fbefeead515de03a49aa0d";
export const zeroPayloadPhpWasmPromotionChangedPaths = Object.freeze([
	"docs/evidence/zero-payload-checked-record-hosted-promotion-20261021.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "scripts/promote-zero-payload-checked-record-hosted.mjs"
	, "tests/helpers/zero-payload-checked-record-hosted-promotion.mjs"
	, "tests/zero-payload-checked-record-hosted-promotion.test.mjs"
]);
export const zeroPayloadPhpWasmPromotionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadPhpWasmPromotionHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact promotion transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadPhpWasmPromotionUpdate = (source, update) => {
	assert.ok([...zeroPayloadPhpWasmPromotionChangedPaths
		, ...zeroPayloadPhpWasmPromotionIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
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
export const beforeZeroPayloadPhpWasmPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadPhpWasmPromotionChangedPaths
			, ...zeroPayloadPhpWasmPromotionIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadPhpWasmPromotionUpdate(source, update)
		: source;
};
