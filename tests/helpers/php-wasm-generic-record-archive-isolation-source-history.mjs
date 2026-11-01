/**
 * Preserve the job-scoped PHP-Wasm generic-record archive materialization.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmGenericRecordArchiveIsolationHistoryPath
	= "docs/evidence/php-wasm-generic-record-archive-isolation-source-history-20261101.json";
export const phpWasmGenericRecordArchiveIsolationPredecessor
	= "77acb1f8648f1c76895128a5199c7104d58e52e1";
export const phpWasmGenericRecordArchiveIsolationImplementation
	= "a0f0891e706f17a213e8506d439ee17c787c6bee";
export const phpWasmGenericRecordArchiveIsolationPinRepair
	= "755dfdb55e69dc60726a30807c2f560aa7485088";
export const phpWasmGenericRecordArchiveIsolationImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "tests/docker-consumer-ci.test.mjs"
	]);
export const phpWasmGenericRecordArchiveIsolationPinPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const phpWasmGenericRecordArchiveIsolationIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmGenericRecordArchiveIsolationHistoryAdditions
	= Object.freeze([
		"scripts/update-php-wasm-generic-record-archive-isolation-source-history.mjs"
		, "tests/helpers/php-wasm-generic-record-archive-isolation-source-history-tests.mjs"
		, "tests/helpers/php-wasm-generic-record-archive-isolation-source-history.mjs"
	]);

const archive = "docs/evidence/php-wasm-generic-records-20261007";

/**
 * Assert that the shared checkout remains metadata-only and only the PHP-Wasm
 * refinements lane materializes the bounded archive after that check passes.
 *
 * @param workflow - Complete Consumer Matrix workflow source.
 * @param regression - Complete downstream source-closure regression source.
 */
export const assertPhpWasmGenericRecordArchiveIsolation = (
	workflow, regression
) => {
	const environment = workflow.split("  LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT: |\n")[1]
		?.split("  LEAN_BRIDGE_DOCUMENTATION_SPARSE_CHECKOUT: |\n")[0];
	assert.ok(environment);
	assert.doesNotMatch(environment
		, /php-wasm-generic-records-20261007/u);
	const job = workflow.split("  php-wasm-corpus:\n")[1]
		?.split("\n  php-wasm-observations:\n")[0];
	assert.ok(job);
	assert.equal(workflow.split(archive).length - 1, 1);
	assert.match(job
		, /^ {6}- name: Materialize the bounded PHP-Wasm generic-record replay archive$/mu);
	assert.match(job, /^ {8}if: matrix[.]profile == 'refinements'$/mu);
	assert.match(job, new RegExp(`^ {10}archive=${archive}$`, "mu"));
	assert.match(job
		, /^ {10}git sparse-checkout add "\/\$archive\/"$/mu);
	assert.match(job, /^ {10}test "\$bytes" -eq 250321$/mu);
	assert.ok(job.indexOf("run: bash scripts/check-consumer-source-closure.sh")
		< job.indexOf("git sparse-checkout add \"/$archive/\""));
	assert.match(regression
		, /if\(name !== "php-wasm-corpus"\)/u);
	assert.match(regression
		, /withoutGenericRecordArchive = source[.]replace\(materialization, ""\)/u);
};

const historyUrl = new URL(
	"../../" + phpWasmGenericRecordArchiveIsolationHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const phpWasmGenericRecordArchiveIsolationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: phpWasmGenericRecordArchiveIsolationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().pinUpdates.map(update => update.path)
			: phpWasmGenericRecordArchiveIsolationPinPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...phpWasmGenericRecordArchiveIsolationImplementationPaths
	, ...phpWasmGenericRecordArchiveIsolationPinPaths
	, ...phpWasmGenericRecordArchiveIsolationIntegrationPaths
].includes(path);

/**
 * Reverse one authenticated archive-isolation transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reversePhpWasmGenericRecordArchiveIsolationUpdate
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
 * Remove only the authenticated archive-isolation transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePhpWasmGenericRecordArchiveIsolationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmGenericRecordArchiveIsolationNormalizationPaths
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
			current = reversePhpWasmGenericRecordArchiveIsolationUpdate(
				current, update);
	}
	return current;
};
