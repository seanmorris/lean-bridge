/**
 * Reverse the dependent checked-record browser diagnostic repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordBrowserDiagnosticRepairHistoryPath
	= "docs/evidence/dependent-checked-record-browser-diagnostic-repair-source-history-20261022.json";
export const dependentCheckedRecordBrowserDiagnosticRepairPredecessor
	= "2e5facfb946f9156ea119823380abaf5bf072752";
export const dependentCheckedRecordBrowserDiagnosticRepairImplementation
	= "ca36284777b57cf8b2f619450926717dead64a0b";
export const dependentCheckedRecordBrowserDiagnosticRepairIntegrationBase
	= "1d1a836956970b1ca6f8de61fa991b49f1e0b76c";
export const dependentCheckedRecordBrowserDiagnosticRepairChangedPaths
	= Object.freeze([
		"tests/fixtures/dependent-checked-record-browser/javascript.mjs"
		, "tests/helpers/dependent-checked-record-browser-installed-tests.mjs"
		, "tests/helpers/dependent-checked-record-browser-report.mjs"
		, "tests/helpers/dependent-checked-record-browser-tests.mjs"
	]);
export const dependentCheckedRecordBrowserDiagnosticRepairPointerPaths
	= Object.freeze(["tests/native-subtype.test.mjs"]);
export const dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, ...dependentCheckedRecordBrowserDiagnosticRepairPointerPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordBrowserDiagnosticRepairHistoryPath, "utf8"));
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
 * Restore one exact browser diagnostic implementation transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordBrowserDiagnosticRepairUpdate = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordBrowserDiagnosticRepairChangedPaths);

/**
 * Restore one exact source-history integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordBrowserDiagnosticRepairIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths);

/**
 * Remove this exact browser diagnostic repair and its history integration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentCheckedRecordBrowserDiagnosticRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths
		, ...dependentCheckedRecordBrowserDiagnosticRepairChangedPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordBrowserDiagnosticRepairIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentCheckedRecordBrowserDiagnosticRepairUpdate(source, update)
		: source;
};
