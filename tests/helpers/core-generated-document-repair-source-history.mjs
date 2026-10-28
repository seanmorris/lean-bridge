/**
 * Preserve the exact generated consumer-document repair and its central
 * history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreGeneratedDocumentRepairHistoryPath
	= "docs/evidence/core-generated-document-repair-source-history-20261028.json";
export const coreGeneratedDocumentRepairPredecessor
	= "ade7780d151b2568743ceec7e312e48eed232081";
export const coreGeneratedDocumentRepairImplementation
	= "494a9c00adf44e0fc632e32223fe92093808e445";
export const coreGeneratedDocumentRepairCommits = Object.freeze([
	"99e9576b94925aba0e89eaee61a11678a739b217"
	, coreGeneratedDocumentRepairImplementation
]);
export const coreGeneratedDocumentRepairImplementationPaths = Object.freeze([
	"docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
]);
export const coreGeneratedDocumentRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreGeneratedDocumentRepairNormalizationPaths = Object.freeze([
	...coreGeneratedDocumentRepairImplementationPaths
	, ...coreGeneratedDocumentRepairIntegrationPaths
]);
export const coreGeneratedDocumentRepairAddedPaths = Object.freeze([
	"scripts/update-core-generated-document-repair-source-history.mjs"
	, "tests/helpers/core-generated-document-repair-source-history-tests.mjs"
	, "tests/helpers/core-generated-document-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreGeneratedDocumentRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCoreGeneratedDocumentRepairUpdate = (source, update) => {
	assert.ok(coreGeneratedDocumentRepairNormalizationPaths.includes(update.path));
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
 * Remove only the recognized document repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreGeneratedDocumentRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreGeneratedDocumentRepairNormalizationPaths.includes(path))
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
		current = reverseCoreGeneratedDocumentRepairUpdate(current, update);
	}
	return current;
};
