/**
 * Reverse the authenticated zero-payload browser execution milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadBrowserHistoryPath
	= "docs/evidence/zero-payload-browser-source-history-20261021.json";
export const zeroPayloadBrowserPredecessor
	= "f49d1344f5fc174f3ce53a816fac71f62144ac6a";
export const zeroPayloadBrowserImplementation
	= "376f410c055cf657e99a29683d2b4f64bd5df1a4";
export const zeroPayloadBrowserChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-browser-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-npm-installed-tests.mjs"
	, "tests/helpers/zero-payload-npm-installed-source-history-tests.mjs"
	, "tests/zero-payload-checked-record-javascript.test.mjs"
]);
export const zeroPayloadBrowserIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadBrowserHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadBrowserUpdate = (source, update) => {
	assert.ok([...zeroPayloadBrowserChangedPaths
		, ...zeroPayloadBrowserIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact zero-payload browser milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadBrowserSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadBrowserChangedPaths
		, ...zeroPayloadBrowserIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadBrowserUpdate(source, update)
		: source;
};
