/**
 * Preserve the source-history ordering repair that lets the newer Perl
 * registration unwind before the older native Binding-IR lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexNativeBindingIrOrderingRepairHistoryPath
	= "docs/evidence/value-index-native-binding-ir-ordering-repair-source-history-20261019.json";
export const valueIndexNativeBindingIrOrderingRepairPredecessor
	= "3115f4e14fba336df21bac033c6494410c82a75f";
export const valueIndexNativeBindingIrOrderingRepairChangedPaths = Object.freeze([
	"tests/checked-record-value-index-native.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const valueIndexNativeBindingIrOrderingRepairAddedPaths = Object.freeze([
	"scripts/update-value-index-native-binding-ir-ordering-repair-source-history.mjs"
	, "tests/helpers/value-index-native-binding-ir-ordering-repair-source-history-tests.mjs"
	, "tests/helpers/value-index-native-binding-ir-ordering-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	valueIndexNativeBindingIrOrderingRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact ordering-repair transition.
 *
 * @param source - Current source text.
 * @param update - Authenticated source transition.
 */
export const reverseValueIndexNativeBindingIrOrderingRepairUpdate = (
	source, update
) => {
	assert.ok(valueIndexNativeBindingIrOrderingRepairChangedPaths.includes(
		update.path));
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
 * Remove only the exact ordering-repair layer from a current source file.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeValueIndexNativeBindingIrOrderingRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !valueIndexNativeBindingIrOrderingRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseValueIndexNativeBindingIrOrderingRepairUpdate(source, update)
		: source;
};
