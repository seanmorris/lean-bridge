/**
 * Reverse the dependent checked-record payload-field foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordFoundationHistoryPath
	= "docs/evidence/dependent-checked-record-foundation-source-history-20261021.json";
export const dependentCheckedRecordFoundationPredecessor
	= "37b789cc0618944f0cbfeabcc1bb5d9fb0427bea";
export const dependentCheckedRecordFoundationImplementation
	= "9e228d9c8d5eca9fbf7eb6338a1f99e7dcac42a2";
export const dependentCheckedRecordFoundationChangedPaths = Object.freeze([
	"schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "schema/native-metadata-type.schema.json"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-model.mjs"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-fixture.mjs"
]);
export const dependentCheckedRecordFoundationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordFoundationHistoryPath, "utf8"
));

/**
 * Restore one authenticated dependent checked-record transition.
 *
 * @param source - Complete source at the transition endpoint.
 * @param update - Authenticated transition record.
 */
export const reverseDependentCheckedRecordFoundationUpdate = (
	source, update
) => {
	assert.ok([...dependentCheckedRecordFoundationChangedPaths
		, ...dependentCheckedRecordFoundationIntegrationPaths]
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
 * Remove only the exact dependent checked-record foundation layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordFoundationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...dependentCheckedRecordFoundationChangedPaths
			, ...dependentCheckedRecordFoundationIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordFoundationUpdate(source, update)
		: source;
};
