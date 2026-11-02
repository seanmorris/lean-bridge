/**
 * Preserve the exact-head Core and Native PHP replay contract repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const exactHeadReplayContractRepairHistoryPath
	= "docs/evidence/exact-head-replay-contract-repair-source-history-20261102.json";
export const exactHeadReplayContractRepairPredecessor
	= "3c345fdbd765422c825dcd8ff889973885189d60";
export const exactHeadReplayContractRepairImplementation
	= "9f99036ebdeca984c32ef1f24b17b9f2b9276ef8";
export const exactHeadReplayContractRepairImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/fixtures/structured-callable-consumers/php-recursive-ownership.php"
		, "tests/helpers/reviewed-fin-refusal-ci-tests.mjs"
		, "tests/helpers/reviewed-fin-wasm-refusal-evidence.mjs"
	]);
export const exactHeadReplayContractRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const exactHeadReplayContractRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-exact-head-replay-contract-repair-source-history.mjs"
		, "tests/helpers/exact-head-replay-contract-repair-source-history-tests.mjs"
		, "tests/helpers/exact-head-replay-contract-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${exactHeadReplayContractRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const exactHeadReplayContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...exactHeadReplayContractRepairImplementationPaths
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: exactHeadReplayContractRepairIntegrationPaths)
	])].sort());
const allowedPath = path =>
	exactHeadReplayContractRepairImplementationPaths.includes(path)
	|| exactHeadReplayContractRepairIntegrationPaths.includes(path);

/**
 * Require the repaired current contracts without interpreting old evidence as current.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertExactHeadReplayContractRepair = sources => {
	for(const path of exactHeadReplayContractRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const refusal = sources["tests/helpers/reviewed-fin-refusal-ci-tests.mjs"];
	assert.match(refusal
		, /const cFamily = \/\\\(matrix\\\.profile == 'c-family'/u);
	assert.match(refusal
		, /for\(const step of \["ordinary_c", "type_corpus_c_family"\]\)/u);
	const wasm = sources[
		"tests/helpers/reviewed-fin-wasm-refusal-evidence.mjs"];
	for(const symbol of [
		"reviewedFinWasmPreFieldIr"
		, "reviewedFinWasmPreFieldMismatches"
		, "reviewedFinWasmPreFieldTypeScript"
	]) assert.ok(wasm.includes(symbol), symbol);
	assert.match(wasm
		, /const expected = reviewedFinWasmPreFieldIr\(selection\);/u);
	assert.doesNotMatch(wasm, /import \{ reviewedFinWasmIr \}/u);
	const php = sources[
		"tests/fixtures/structured-callable-consumers/php-recursive-ownership.php"];
	assert.match(php
		, /\$borrow->invoke\(\$runtime,\$signature,\$callback,\$frame,null\);/u);
	const inventory = JSON.parse(sources["docs/type-surface.v1.json"]);
	const path = "tests/fixtures/structured-callable-consumers/php-recursive-ownership.php";
	const pins = inventory.evidence.flatMap(item => item.files)
		.filter(file => file.path === path);
	assert.equal(pins.length, 1);
	assert.equal(pins[0].sha256, sha256(php));
	return { livePinRefreshes: pins.length, changedSupportCells: 0 };
};

/**
 * Reverse one authenticated exact-head replay contract transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseExactHeadReplayContractRepairUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated exact-head replay contract transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeExactHeadReplayContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !exactHeadReplayContractRepairNormalizationPaths.includes(path)
		|| !existsSync(historyUrl)) return source;
	let current = source;
	for(const update of [
		...record().integrationUpdates, ...record().updates
	]) {
		if(expected !== undefined && sha256(current) === expected) return current;
		if(update.path === path && update.currentSha256 === sha256(current))
			current = reverseExactHeadReplayContractRepairUpdate(current, update);
	}
	return current;
};
