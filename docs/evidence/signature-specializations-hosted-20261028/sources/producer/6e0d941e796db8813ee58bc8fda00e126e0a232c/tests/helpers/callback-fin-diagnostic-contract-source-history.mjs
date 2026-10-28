/**
 * Authenticate the installed managed-host callback-Fin diagnostic contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinDiagnosticContractHistoryPath
	= "docs/evidence/callback-fin-diagnostic-contract-source-history-20261028.json";
export const callbackFinDiagnosticContractPredecessor
	= "ad0967cf2bb752d6857ba29544da956fe0bca5c9";
export const callbackFinDiagnosticContractImplementation
	= "028fef2b4b5fd34256ddad4e2fe414fb4ad0f451";
export const callbackFinDiagnosticContractChangedPaths = Object.freeze([
	"tests/callback-fin-remaining-package.test.mjs"
	, "tests/fixtures/callback-fin-consumers/dotnet.cs"
	, "tests/fixtures/callback-fin-consumers/java.java"
	, "tests/fixtures/callback-fin-consumers/kotlin.kt"
]);
export const callbackFinDiagnosticContractIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-07.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinDiagnosticContractNormalizationPaths = Object.freeze([
	...callbackFinDiagnosticContractChangedPaths
	, ...callbackFinDiagnosticContractIntegrationPaths
].toSorted());
export const callbackFinDiagnosticContractAddedPaths = Object.freeze([
	"scripts/update-callback-fin-diagnostic-contract-source-history.mjs"
	, "tests/helpers/callback-fin-diagnostic-contract-source-history-tests.mjs"
	, "tests/helpers/callback-fin-diagnostic-contract-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinDiagnosticContractHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinDiagnosticContractUpdate = (source, update) => {
	assert.ok(callbackFinDiagnosticContractNormalizationPaths.includes(update.path));
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact diagnostic-contract transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCallbackFinDiagnosticContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackFinDiagnosticContractNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCallbackFinDiagnosticContractUpdate(current, update);
	}
	return current;
};
