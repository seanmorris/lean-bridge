/**
 * Authenticate exact checked-refinement diagnostics in native PHP graph packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeCiContractRepairSource } from "./ci-contract-repair-source-history.mjs";
import {
	beforeRecursiveCheckedRecordPerlPackageHistoryRepairPins
	, beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource
} from "./recursive-checked-record-perl-package-history-repair.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const phpGraphDiagnosticHistoryPath
	= "docs/evidence/php-graph-diagnostic-source-history-20261017.json";
export const phpGraphDiagnosticPredecessor
	= "5945275186d718c2bd70dad042ce0ff52b4ce0b6";
export const phpGraphDiagnosticDraftParent
	= "5945275186d718c2bd70dad042ce0ff52b4ce0b6";
export const phpGraphDiagnosticChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/backends/php/copied-graph-assets.mjs"
	, "src/backends/php/copied-graph-conversions.mjs"
	, "src/backends/php/copied-graph-package.mjs"
	, "src/backends/php/copied-graph-transfer.mjs"
	, "src/backends/php/package-audit.mjs"
	, "src/release/native-composer.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reversePhpGraphDiagnosticUpdate = (source, update) => {
	assert.ok(phpGraphDiagnosticChangedPaths.includes(update.path));
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

/**
 * Remove only this PHP graph diagnostic transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutPhpGraphDiagnostic = (path, source) => {
	if(typeof source !== "string"
		|| !phpGraphDiagnosticChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		phpGraphDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reversePhpGraphDiagnosticUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpGraphDiagnosticSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !phpGraphDiagnosticChangedPaths.includes(path))
		return beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource(path, source, expected);
	let digest = sha256(source);
	if(digest === expected) return source;
	const previous = withoutPhpGraphDiagnostic(path, source);
	if(previous !== source)
	{
		source = previous;
		digest = sha256(source);
		if(digest === expected) return source;
	}
	source = beforeCiContractRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	return beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforePhpGraphDiagnosticPins = inventory => {
	const record = history ??= JSON.parse(readFileSync(
		phpGraphDiagnosticHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path
		=== "docs/type-surface.v1.json");
	const current = JSON.stringify(inventory, null, 2) + "\n";
	let previous = update?.currentSha256 === sha256(current)
		? JSON.parse(reversePhpGraphDiagnosticUpdate(current, update))
		: structuredClone(inventory);
	previous = JSON.parse(beforeCiContractRepairSource(
		"docs/type-surface.v1.json"
		, JSON.stringify(previous, null, 2) + "\n"
	));
	return beforeRecursiveCheckedRecordPerlPackageHistoryRepairPins(previous);
};
