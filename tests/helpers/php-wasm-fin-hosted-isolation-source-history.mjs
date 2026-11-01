/**
 * Preserve the hosted PHP-Wasm Fin probe isolation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmFinHostedIsolationHistoryPath
	= "docs/evidence/php-wasm-fin-hosted-isolation-source-history-20261101.json";
export const phpWasmFinHostedIsolationPredecessor
	= "6a715d583bc26c31bf5f3db24889859ec4aaa9ca";
export const phpWasmFinHostedIsolationImplementation
	= "0cf2a6f68f502f8363d4d3f64e960af4e9e59b32";
export const phpWasmFinHostedIsolationImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/documentation.test.mjs"
]);
export const phpWasmFinHostedIsolationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/documentation.test.mjs"
]);
export const phpWasmFinHostedIsolationHistoryAdditions = Object.freeze([
	"scripts/update-php-wasm-fin-hosted-isolation-source-history.mjs"
	, "tests/helpers/php-wasm-fin-hosted-isolation-source-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-hosted-isolation-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + phpWasmFinHostedIsolationHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const phpWasmFinHostedIsolationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: phpWasmFinHostedIsolationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	phpWasmFinHostedIsolationImplementationPaths.includes(path)
	|| phpWasmFinHostedIsolationIntegrationPaths.includes(path);
const ordinaryCommand
	= "LEAN_BRIDGE_PHP_WASM_FIN_TEST=1 node --test --test-concurrency=1 --test-name-pattern='relocated PHP-Wasm packages check Fin before Lean in Node and browser hosts' tests/php-wasm-fin.test.mjs";

/**
 * Require the exact current hosted-isolation semantics.
 *
 * @param path - Repository-relative implementation path.
 * @param source - Complete implementation source.
 */
export const assertPhpWasmFinHostedIsolation = (path, source) => {
	assert.ok(phpWasmFinHostedIsolationImplementationPaths.includes(path), path);
	assert.equal(typeof source, "string");
	if(path === ".github/workflows/consumer-matrix.yml")
	{
		assert.equal(source.split(ordinaryCommand).length - 1, 2);
		assert.ok(source.includes(
			`          ${ordinaryCommand}\n          test -s build/php-wasm-fin/ordinary.json\n`));
		assert.ok(source.includes(` && ${ordinaryCommand} && `));
	}
	else
	{
		assert.ok(source.includes(
			`const ordinaryPhpWasmFin = ${JSON.stringify(ordinaryCommand)};`));
		assert.match(source
			, /name[.]includes\("relocated PHP-Wasm packages check Fin before Lean in Node and browser hosts"\)/u);
	}
	return true;
};

/**
 * Reverse one authenticated hosted-isolation transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reversePhpWasmFinHostedIsolationUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only the authenticated hosted-isolation repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePhpWasmFinHostedIsolationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmFinHostedIsolationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePhpWasmFinHostedIsolationUpdate(current, update);
	}
	return current;
};
