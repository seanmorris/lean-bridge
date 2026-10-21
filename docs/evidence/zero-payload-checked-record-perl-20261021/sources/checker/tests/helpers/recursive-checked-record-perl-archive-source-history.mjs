/**
 * Authenticate source integrations omitted from three evidence archives. The
 * immutable evidence trees are content-addressed by their own indexes; this
 * layer closes every pre-existing source file changed by those archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeNestedCheckedRecordRustPromotionSource } from "./nested-checked-record-rust-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveCheckedRecordPerlArchiveHistoryPath
	= "docs/evidence/recursive-checked-record-perl-archive-source-history-20261017.json";
export const recursiveCheckedRecordPerlArchiveCommit
	= "e77239ad65a8cb7e1db1dfdd8a04174214ee404b";
export const recursiveCheckedRecordPerlArchiveParent
	= "c8ac44f43022c7fd49d4bb98a17cf4ae43371909";
export const recursiveCheckedRecordPerlArchivePrimaryChangedPaths = Object.freeze([
	"docs/evidence/README.md"
	, "tests/recursive-checked-record-perl.test.mjs"
]);
export const recursiveCheckedRecordPerlArchiveHistoricalTransitions = Object.freeze([
	Object.freeze({
		commit: "3bb253425cd6bced5dd8fec93a3cf9d25e7f6327"
		, parent: "902e5a399b777c466844b3fc09add71742e149b2"
		, paths: Object.freeze([
			"docs/evidence/README.md"
			, "tests/nested-checked-record-perl.test.mjs"
		])
	})
	, Object.freeze({
		commit: "8008ae87eef3585b00421098eda67b558f6e31f3"
		, parent: "ef8876ba067e29197b32a21eb708b394f4df3568"
		, paths: Object.freeze([
			"docs/evidence/README.md"
			, "tests/helpers/nested-checked-record-jvm-generators.mjs"
			, "tests/nested-checked-record-jvm.test.mjs"
		])
	})
]);
export const recursiveCheckedRecordPerlArchiveChangedPaths = Object.freeze([
	...new Set([
		...recursiveCheckedRecordPerlArchivePrimaryChangedPaths
		, ...recursiveCheckedRecordPerlArchiveHistoricalTransitions
			.flatMap(transition => transition.paths)
	])
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	recursiveCheckedRecordPerlArchiveHistoryPath, "utf8"
));

/**
 * Reverse the exact archive-source transition after authenticating all bytes.
 *
 * @param source - Complete source at the recorded current identity.
 * @param update - Immutable transition for one closed path.
 */
export const reverseRecursiveCheckedRecordPerlArchiveUpdate = (source, update) => {
	assert.ok(recursiveCheckedRecordPerlArchiveChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
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

const withoutUpdates = (path, source, updates) => {
	const update = updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseRecursiveCheckedRecordPerlArchiveUpdate(source, update) : source;
};

/**
 * Remove only the exact archive-source transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source.
 */
export const withoutRecursiveCheckedRecordPerlArchive = (path, source) => {
	if(typeof source !== "string"
		|| !recursiveCheckedRecordPerlArchiveChangedPaths.includes(path))
		return source;
	const transitions = [record().updates
		, ...record().historicalTransitions.map(transition => transition.updates)];
	for(const updates of transitions)
	{
		const previous = withoutUpdates(path, source, updates);
		if(previous !== source) return previous;
	}
	return source;
};

/**
 * Reverse the archive integration, preserving unknown edits and requested epochs.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRecursiveCheckedRecordPerlArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveCheckedRecordPerlArchiveChangedPaths.includes(path))
		return beforeNestedCheckedRecordRustPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutRecursiveCheckedRecordPerlArchive(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordRustPromotionSource(path, source, expected);
};

/**
 * Cross the archive-only gaps in the central source-history replay. Each
 * historical archive follows its already-authenticated promotion layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const throughRecursiveCheckedRecordPerlArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveCheckedRecordPerlArchiveChangedPaths.includes(path))
		return source;
	if(sha256(source) === expected) return source;
	source = withoutUpdates(path, source, record().updates);
	if(sha256(source) === expected) return source;
	for(const transition of record().historicalTransitions)
	{
		source = beforeNestedCheckedRecordRustPromotionSource(
			path, source, expected
		);
		if(sha256(source) === expected) return source;
		source = withoutUpdates(path, source, transition.updates);
		if(sha256(source) === expected) return source;
	}
	return source;
};
