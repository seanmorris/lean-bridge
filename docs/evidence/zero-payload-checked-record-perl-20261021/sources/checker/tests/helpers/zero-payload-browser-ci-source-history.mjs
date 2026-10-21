/**
 * Reverse the authenticated zero-payload browser CI milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadBrowserCiHistoryPath
	= "docs/evidence/zero-payload-browser-ci-source-history-20261021.json";
export const zeroPayloadBrowserCiPredecessor
	= "2b17ad4ca92335e96207f6b7284aa593da1b5cc3";
export const zeroPayloadBrowserCiImplementation
	= "a19641e30017405cc13b0ee0b46a89fac762faa2";
export const zeroPayloadBrowserCiChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-browser-source-history-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-browser.mjs"
	, "tests/helpers/zero-payload-checked-record-npm-installed-tests.mjs"
	, "tests/zero-payload-checked-record-javascript.test.mjs"
]);
export const zeroPayloadBrowserCiIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadBrowserCiHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadBrowserCiUpdate = (source, update) => {
	assert.ok([...zeroPayloadBrowserCiChangedPaths
		, ...zeroPayloadBrowserCiIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload browser CI milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadBrowserCiSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadBrowserCiChangedPaths
		, ...zeroPayloadBrowserCiIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadBrowserCiUpdate(source, update)
		: source;
};
