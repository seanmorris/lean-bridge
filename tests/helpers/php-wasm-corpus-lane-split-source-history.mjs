/**
 * Preserve the exact PHP-Wasm corpus lane split, its resource sampling, its type-surface pin refresh and its
 * central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCorpusLaneSplitHistoryPath
	= "docs/evidence/php-wasm-corpus-lane-split-source-history-20261028.json";
export const phpWasmCorpusLaneSplitPredecessor
	= "dcfd6245f1018a52d9a4d1c938a24ddc258e5fbb";
export const phpWasmCorpusLaneSplitImplementation
	= "07273c447718654410039743bc0a4ef2bcae058a";
export const phpWasmCorpusLaneSplitWorkflowCommit
	= "520d7056090a9bbbafe32929b93e7123f9abdb57";
export const phpWasmCorpusLaneSplitCommits = Object.freeze([
	phpWasmCorpusLaneSplitWorkflowCommit
	, phpWasmCorpusLaneSplitImplementation
]);
export const phpWasmCorpusLaneSplitTypeSurfacePath = "docs/type-surface.v1.json";
export const phpWasmCorpusLaneSplitPinCount = 92;
export const phpWasmCorpusLaneSplitWorkflowPath = ".github/workflows/consumer-matrix.yml";
export const phpWasmCorpusLaneSplitPinnedPaths = Object.freeze([
	phpWasmCorpusLaneSplitWorkflowPath
]);
export const phpWasmCorpusLaneSplitImplementationPaths = Object.freeze([
	phpWasmCorpusLaneSplitWorkflowPath
	, phpWasmCorpusLaneSplitTypeSurfacePath
]);
export const phpWasmCorpusLaneSplitIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmCorpusLaneSplitNormalizationPaths = Object.freeze([
	...phpWasmCorpusLaneSplitImplementationPaths
	, ...phpWasmCorpusLaneSplitIntegrationPaths
]);
export const phpWasmCorpusLaneSplitAddedPaths = Object.freeze([
	"scripts/update-php-wasm-corpus-lane-split-source-history.mjs"
	, "tests/helpers/php-wasm-corpus-lane-split-source-history-tests.mjs"
	, "tests/helpers/php-wasm-corpus-lane-split-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCorpusLaneSplitHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and the current-side edits of one change.
 */
export const reversePhpWasmCorpusLaneSplitUpdate = (source, update) => {
	assert.ok(phpWasmCorpusLaneSplitNormalizationPaths.includes(update.path));
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
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the recognized lane split and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpWasmCorpusLaneSplitSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !phpWasmCorpusLaneSplitNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reversePhpWasmCorpusLaneSplitUpdate(current, update);
	}
	return current;
};
