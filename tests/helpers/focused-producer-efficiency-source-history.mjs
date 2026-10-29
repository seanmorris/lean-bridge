/**
 * Preserve the focused producer checkout and workload optimization.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const focusedProducerEfficiencyHistoryPath
	= "docs/evidence/focused-producer-efficiency-source-history-20261029.json";
export const focusedProducerEfficiencyPredecessor
	= "dac39fd15dd5141c0b9fe4ecd6962d2f0e548fa3";
export const focusedProducerEfficiencyImplementation
	= "6cf8e53b1a5015c2d3e3f7100e14fdf4a4caf3f4";
export const focusedProducerEfficiencyImplementationPaths = Object.freeze([
	".github/workflows/generic-subtype-languages.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, "tests/helpers/generic-subtype-npm-browser-ci-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
]);
export const focusedProducerEfficiencyIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-route-binder-repair-source-history-tests.mjs"
]);
export const focusedProducerEfficiencyHistoryAdditions = Object.freeze([
	"scripts/update-focused-producer-efficiency-source-history.mjs"
	, "tests/helpers/focused-producer-efficiency-source-history-tests.mjs"
	, "tests/helpers/focused-producer-efficiency-source-history.mjs"
]);

const historyUrl = new URL(`../../${focusedProducerEfficiencyHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const focusedProducerEfficiencyNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: focusedProducerEfficiencyImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])
].sort());
const allowed = path => focusedProducerEfficiencyImplementationPaths
	.includes(path) || focusedProducerEfficiencyIntegrationPaths.includes(path);

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseFocusedProducerEfficiencyUpdate = (source, update) => {
	assert.ok(allowed(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const pieces = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		pieces.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	pieces.push(source.slice(cursor));
	const previous = pieces.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the focused-producer optimization from current or historical text.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeFocusedProducerEfficiencySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !focusedProducerEfficiencyNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseFocusedProducerEfficiencyUpdate(
			current, update);
	}
	return current;
};
