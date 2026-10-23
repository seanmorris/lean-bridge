/**
 * Reverse the authenticated WIT dependent checked-record consumer-root repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const witConsumerRootRepairHistoryPath
	= "docs/evidence/wit-consumer-root-repair-source-history-20261022.json";
export const witConsumerRootRepairPredecessor
	= "36a4cd72c660427534af9d01b9e8bb74c0521cd5";
export const witConsumerRootRepairImplementation
	= "bef4ad20de7565fc6d586fb9216b4d69180770bd";
export const witConsumerRootRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const witConsumerRootRepairImplementationPaths = Object.freeze([
	"tests/helpers/dependent-checked-record-wit-fixture-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-fixture.mjs"
	, "tests/helpers/dependent-checked-record-wit-installed-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-report.mjs"
]);
export const witConsumerRootRepairChangedPaths = Object.freeze([
	...witConsumerRootRepairImplementationPaths
	, ...witConsumerRootRepairIntegrationPaths
]);
export const witConsumerRootRepairAddedPaths = Object.freeze([
	"scripts/update-wit-consumer-root-repair-source-history.mjs"
	, "tests/helpers/wit-consumer-root-repair-source-history-tests.mjs"
	, "tests/helpers/wit-consumer-root-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	witConsumerRootRepairHistoryPath, "utf8"));

/**
 * Restore one exact source transition after authenticating its endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWitConsumerRootRepairUpdate = (source, update) => {
	assert.ok(witConsumerRootRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
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
 * Remove only this exact WIT consumer-root repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeWitConsumerRootRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !witConsumerRootRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update ? reverseWitConsumerRootRepairUpdate(source, update) : source;
};
