/**
 * Reverse the retained WIT pkg-config parser repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordWitRetainedPkgConfigRepairHistoryPath
	= "docs/evidence/dependent-checked-record-wit-retained-pkg-config-repair-source-history-20261022.json";
export const dependentCheckedRecordWitRetainedPkgConfigRepairPredecessor
	= "b4664a668bab070377beda8c9bc754c4930ed8ab";
export const dependentCheckedRecordWitRetainedPkgConfigRepairImplementation
	= "170d1e54b2a23346ac825e25afd7ba612960c74a";
export const dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationBase
	= "170d1e54b2a23346ac825e25afd7ba612960c74a";
export const dependentCheckedRecordWitRetainedPkgConfigRepairChangedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-wit-environment-records.mjs"
		, "tests/helpers/dependent-checked-record-wit-fixture-tests.mjs"
	]);
export const dependentCheckedRecordWitRetainedPkgConfigRepairPointerPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, ...dependentCheckedRecordWitRetainedPkgConfigRepairPointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordWitRetainedPkgConfigRepairHistoryPath, "utf8"));
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
 * Restore one exact retained-record parser transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordWitRetainedPkgConfigRepairUpdate
	= (source, update) => reverse(source, update
		, dependentCheckedRecordWitRetainedPkgConfigRepairChangedPaths);

/**
 * Restore one exact source-history integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordWitRetainedPkgConfigRepairIntegration
	= (source, update) => reverse(source, update
		, dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationPaths);

/**
 * Remove this exact retained WIT parser repair and its history integration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentCheckedRecordWitRetainedPkgConfigRepairSource
	= (path, source, expected) => {
		if(typeof source !== "string") return source;
		const selected = [
			...dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationPaths
			, ...dependentCheckedRecordWitRetainedPkgConfigRepairChangedPaths
		];
		if(!selected.includes(path)) return source;
		let digest = sha256(source);
		if(digest === expected) return source;
		const integration = record().integrationUpdates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(integration)
		{
			source = reverseDependentCheckedRecordWitRetainedPkgConfigRepairIntegration(
				source, integration);
			digest = sha256(source);
			if(digest === expected) return source;
		}
		const update = record().updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		return update
			? reverseDependentCheckedRecordWitRetainedPkgConfigRepairUpdate(
				source, update)
			: source;
	};
