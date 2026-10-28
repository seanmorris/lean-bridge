/**
 * Reverse the hosted .NET zero-payload promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadDotnetPromotionHistoryPath
	= "docs/evidence/zero-payload-dotnet-promotion-source-history-20261021.json";
export const zeroPayloadDotnetPromotionPredecessor
	= "0f71a0fd939172d767c96743ca59e203f075943c";
export const zeroPayloadDotnetPromotionImplementation
	= "aeebd511792e4826405f97dea85d1561747a62e7";
export const zeroPayloadDotnetPromotionChangedPaths = Object.freeze([
	"docs/consume/dotnet.md"
	, "docs/evidence/README.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const zeroPayloadDotnetPromotionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadDotnetPromotionHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact promotion transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadDotnetPromotionUpdate = (source, update) => {
	assert.ok([...zeroPayloadDotnetPromotionChangedPaths
		, ...zeroPayloadDotnetPromotionIntegrationPaths].includes(update.path));
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
export const beforeZeroPayloadDotnetPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadDotnetPromotionChangedPaths
			, ...zeroPayloadDotnetPromotionIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadDotnetPromotionUpdate(source, update) : source;
};
