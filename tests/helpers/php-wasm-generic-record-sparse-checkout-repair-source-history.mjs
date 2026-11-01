/**
 * Preserve the PHP-Wasm generic-record sparse-checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmGenericRecordSparseCheckoutRepairHistoryPath
	= "docs/evidence/php-wasm-generic-record-sparse-checkout-repair-source-history-20261101.json";
export const phpWasmGenericRecordSparseCheckoutRepairPredecessor
	= "67af49f9446b5d230df73829579c485038d85d82";
export const phpWasmGenericRecordSparseCheckoutRepairImplementation
	= "ba98dd12a4dec7d6c44e5e9b40ebdb25e484663c";
export const phpWasmGenericRecordSparseCheckoutRepairPinRepair
	= "c8f1c01e988672fd91aba92680a1048ec2f42b81";
export const phpWasmGenericRecordSparseCheckoutRepairImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "tests/docker-consumer-ci.test.mjs"
	]);
export const phpWasmGenericRecordSparseCheckoutRepairPinPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmGenericRecordSparseCheckoutRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-php-wasm-generic-record-sparse-checkout-repair-source-history.mjs"
		, "tests/helpers/php-wasm-generic-record-sparse-checkout-repair-source-history-tests.mjs"
		, "tests/helpers/php-wasm-generic-record-sparse-checkout-repair-source-history.mjs"
	]);

const archivePattern
	= "/docs/evidence/php-wasm-generic-records-20261007/";

/**
 * Assert that the workflow retains the archive consumed by the generic-record
 * replay and that the source-closure regression owns that dependency.
 *
 * @param workflow - Complete Consumer Matrix workflow source.
 * @param regression - Complete downstream source-closure regression source.
 */
export const assertPhpWasmGenericRecordSparseCheckoutRepair = (
	workflow, regression
) => {
	assert.equal(workflow.split(archivePattern).length - 1, 1);
	assert.match(workflow
		, /LEAN_BRIDGE_PHP_WASM_GENERIC_RECORD_TEST=1 node --test --test-concurrency=1 tests\/php-wasm-generic-records[.]test[.]mjs/u);
	assert.ok(regression.includes(`\t, "${archivePattern}"`));
	assert.match(regression
		, /const phpWasmCorpus = jobs[.]get\("php-wasm-corpus"\);/u);
	assert.match(regression
		, /withoutGenericRecordArchive = source[.]replace\(archivePattern, ""\)/u);
	assert.match(regression
		, /"PHP-Wasm generic-record archive"/u);
};

const historyUrl = new URL(
	"../../" + phpWasmGenericRecordSparseCheckoutRepairHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const phpWasmGenericRecordSparseCheckoutRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: phpWasmGenericRecordSparseCheckoutRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().pinUpdates.map(update => update.path)
			: phpWasmGenericRecordSparseCheckoutRepairPinPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...phpWasmGenericRecordSparseCheckoutRepairImplementationPaths
	, ...phpWasmGenericRecordSparseCheckoutRepairPinPaths
	, ...phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths
].includes(path);

/**
 * Reverse one authenticated sparse-checkout repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reversePhpWasmGenericRecordSparseCheckoutRepairUpdate
	= (source, update) => {
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
 * Remove only the authenticated PHP-Wasm sparse-checkout repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePhpWasmGenericRecordSparseCheckoutRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmGenericRecordSparseCheckoutRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().pinUpdates, record().updates
	]) {
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePhpWasmGenericRecordSparseCheckoutRepairUpdate(
				current, update);
	}
	return current;
};
