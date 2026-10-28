/**
 * Reverse the dependent checked-record WIT pkg-config space-path repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordWitPkgConfigSpaceRepairHistoryPath
	= "docs/evidence/dependent-checked-record-wit-pkg-config-space-repair-source-history-20261022.json";
export const dependentCheckedRecordWitPkgConfigSpaceRepairPredecessor
	= "7c17c2362eec983a1bb6d294440ef7b1f150f1a5";
export const dependentCheckedRecordWitPkgConfigSpaceRepairImplementation
	= "657caf5e1b43f839f044b2d17eb5451eff4e1ef9";
export const dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationBase
	= "657caf5e1b43f839f044b2d17eb5451eff4e1ef9";
export const dependentCheckedRecordWitPkgConfigSpaceRepairChangedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-wit-fixture-tests.mjs"
		, "tests/helpers/dependent-checked-record-wit-install.mjs"
	]);
export const dependentCheckedRecordWitPkgConfigSpaceRepairPointerPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, ...dependentCheckedRecordWitPkgConfigSpaceRepairPointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordWitPkgConfigSpaceRepairHistoryPath, "utf8"));
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
 * Restore one exact WIT pkg-config implementation transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordWitPkgConfigSpaceRepairUpdate
	= (source, update) => reverse(source, update
		, dependentCheckedRecordWitPkgConfigSpaceRepairChangedPaths);

/**
 * Restore one exact source-history integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordWitPkgConfigSpaceRepairIntegration
	= (source, update) => reverse(source, update
		, dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationPaths);

/**
 * Remove this exact WIT pkg-config repair and its history integration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentCheckedRecordWitPkgConfigSpaceRepairSource
	= (path, source, expected) => {
		if(typeof source !== "string") return source;
		const selected = [
			...dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationPaths
			, ...dependentCheckedRecordWitPkgConfigSpaceRepairChangedPaths
		];
		if(!selected.includes(path)) return source;
		let digest = sha256(source);
		if(digest === expected) return source;
		const integration = record().integrationUpdates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(integration)
		{
			source = reverseDependentCheckedRecordWitPkgConfigSpaceRepairIntegration(
				source, integration);
			digest = sha256(source);
			if(digest === expected) return source;
		}
		const update = record().updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		return update
			? reverseDependentCheckedRecordWitPkgConfigSpaceRepairUpdate(source, update)
			: source;
	};
