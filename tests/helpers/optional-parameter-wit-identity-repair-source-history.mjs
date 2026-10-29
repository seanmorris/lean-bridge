/**
 * Preserve the optional-parameter WIT package-identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterWitIdentityRepairHistoryPath
	= "docs/evidence/optional-parameter-wit-identity-repair-source-history-20261029.json";
export const optionalParameterWitIdentityRepairPredecessor
	= "d73a83612d4ecd0f1f0f0ead15b343f45d4e9e5f";
export const optionalParameterWitIdentityRepairImplementation
	= "a1043f127a6f3dd9d6d5443e36398c8bb4e4424a";
export const optionalParameterWitIdentityRepairImplementationPaths
	= Object.freeze(["tests/optional-parameter-wit-installed.test.mjs"]);
export const optionalParameterWitIdentityRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/focused-producer-efficiency-source-history-tests.mjs"
]);
export const optionalParameterWitIdentityRepairHistoryAdditions = Object.freeze([
	"scripts/update-optional-parameter-wit-identity-repair-source-history.mjs"
	, "tests/helpers/optional-parameter-wit-identity-repair-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-wit-identity-repair-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${optionalParameterWitIdentityRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterWitIdentityRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterWitIdentityRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterWitIdentityRepairImplementationPaths
	.includes(path) || optionalParameterWitIdentityRepairIntegrationPaths
	.includes(path);

/**
 * Reverse one exact authenticated WIT identity transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterWitIdentityRepairUpdate = (
	source, update
) => {
	assert.ok(allowed(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const pieces = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		pieces.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	pieces.push(source.slice(cursor));
	const previous = pieces.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the WIT identity repair from current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterWitIdentityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterWitIdentityRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterWitIdentityRepairUpdate(
			current, update);
	}
	return current;
};
