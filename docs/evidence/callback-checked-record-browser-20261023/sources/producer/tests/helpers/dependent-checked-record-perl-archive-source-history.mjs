/**
 * Preserve the exact hosted Perl dependent checked-record archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPerlArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-perl-archive-source-history-20261021.json";
export const dependentCheckedRecordPerlArchivePredecessor
	= "bde83efb0f81e0a7b74bf58c8c1886dbaa5784de";
export const dependentCheckedRecordPerlArchiveImplementation
	= "02bb4fcbb25a71687b221d1cf9bb2196dace8165";
export const dependentCheckedRecordPerlArchiveRoot
	= "docs/evidence/dependent-checked-record-perl-20261021";
export const dependentCheckedRecordPerlArchiveIndexSha256
	= "53bdc2212215d7f569b5158c436a002d6a16f9903be033c378ed7ef31f17d95f";
export const dependentCheckedRecordPerlArchiveIndexedFileCount = 1493;
export const dependentCheckedRecordPerlArchiveFileCount = 1494;
export const dependentCheckedRecordPerlArchiveAddedFileCount = 1496;
export const dependentCheckedRecordPerlArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-perl-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-perl-evidence.mjs"
	]);
export const dependentCheckedRecordPerlArchiveImplementationPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordPerlArchivePointerPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const dependentCheckedRecordPerlArchiveIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, ...dependentCheckedRecordPerlArchivePointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPerlArchiveHistoryPath, "utf8"
));
const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
 * Reverse one exact archive implementation update.
 *
 * @param source - Complete current source text.
 * @param update - Exact implementation transition.
 */
export const reverseDependentCheckedRecordPerlArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordPerlArchiveImplementationPaths);

/**
 * Reverse one exact archive-history integration update.
 *
 * @param source - Complete current source text.
 * @param update - Exact integration transition.
 */
export const reverseDependentCheckedRecordPerlArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordPerlArchiveIntegrationPaths);

/**
 * Remove this archive history integration and, when needed, the archive's
 * original test registration without skipping either authenticated state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which reconstruction stops.
 */
export const beforeDependentCheckedRecordPerlArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordPerlArchiveIntegrationPaths
		, ...dependentCheckedRecordPerlArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordPerlArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordPerlArchiveImplementation(
			source, implementation)
		: source;
};
