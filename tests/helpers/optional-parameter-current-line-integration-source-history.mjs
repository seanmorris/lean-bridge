/**
 * Reconstruct either parent of the optional-parameter merge without rewriting
 * the independently authenticated optional implementation history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterCurrentLineIntegrationHistoryPath
	= "docs/evidence/optional-parameter-current-line-integration-source-history-20261029.json";
export const optionalParameterCurrentLineIntegrationMerge
	= "a30d28953643fef04073e3fb9ccab53b74d720d7";
export const optionalParameterCurrentLineIntegrationCurrentParent
	= "4c5f13b6b6c84ba7f463e52538fbf86cfd18830c";
export const optionalParameterCurrentLineIntegrationOptionalParent
	= "3cb418f0506873e33f0206a6ac662dd713d418c2";
export const optionalParameterCurrentLineIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const optionalParameterCurrentLineIntegrationRegistrationPaths
	= Object.freeze([...optionalParameterCurrentLineIntegrationPaths
		, "tests/perl-contract.test.mjs"
		, "nix/perl-engine-source-boundary.json"]);
export const optionalParameterCurrentLineIntegrationAddedPaths = Object.freeze([
	"scripts/update-optional-parameter-current-line-integration-source-history.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history.mjs"
]);

let history;
const historyUrl = new URL(
	`../../${optionalParameterCurrentLineIntegrationHistoryPath}`
	, import.meta.url
);
const record = () => history ??= JSON.parse(readFileSync(
	historyUrl, "utf8"));
export const optionalParameterCurrentLineIntegrationNormalizationPaths
	= Object.freeze([...new Set([
		...record().currentParentUpdates.map(item => item.path)
		, ...record().optionalParentUpdates.map(item => item.path)
		, ...record().integrationUpdates.map(item => item.path)
	])].sort());

/**
 * Reverse one exact merge or registration transition.
 *
 * @param source - Complete later source.
 * @param update - Exact changed spans and endpoint identities.
 */
export const reverseOptionalParameterCurrentLineIntegrationUpdate
	= (source, update) => {
		assert.ok(optionalParameterCurrentLineIntegrationNormalizationPaths
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
				, edit.start + edit.current.length), edit.current, update.path);
			parts.push(source.slice(cursor, edit.start), edit.previous);
			cursor = edit.start + edit.current.length;
		}
		parts.push(source.slice(cursor));
		const previous = parts.join("");
		assert.equal(sha256(previous), update.previousSha256, update.path);
		return previous;
	};

const reverseMatching = (path, source, updates) => {
	const digest = sha256(source);
	const update = updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOptionalParameterCurrentLineIntegrationUpdate(source, update);
};

/**
 * Remove the current-line registration, then select the authenticated merge
 * parent capable of reaching the requested digest. Optional-history endpoint
 * requests follow the optional parent; every other request follows the newer
 * current #1220 line. With no requested digest, the current line is canonical.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical SHA-256.
 */
export const beforeOptionalParameterCurrentLineIntegrationSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !optionalParameterCurrentLineIntegrationNormalizationPaths
				.includes(path)) return source;
		let current = reverseMatching(path, source, record().integrationUpdates);
		if(expected !== undefined && sha256(current) === expected) return current;
		const optionalDigests = record().optionalExpectedDigests
			.find(item => item.path === path)?.digests ?? [];
		if(expected !== undefined && optionalDigests.includes(expected))
			return reverseMatching(path, current, record().optionalParentUpdates);
		return reverseMatching(path, current, record().currentParentUpdates);
	};
