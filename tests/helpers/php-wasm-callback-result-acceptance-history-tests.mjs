/**
 * Verify PHP-Wasm callback-result acceptance source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPhpWasmCallbackResultHistory, beforePhpWasmCallbackResultAcceptance
	, phpWasmCallbackResultIntroducedPaths, phpWasmCallbackResultModifiedPaths
	, phpWasmCallbackResultReaderPaths, readPhpWasmCallbackResultHistory
	, reversePhpWasmCallbackResultUpdate } from "./php-wasm-callback-result-acceptance-history.mjs";

test("PHP-Wasm callback-result history closes implementation, receipt and readers", () => {
	const record = readPhpWasmCallbackResultHistory(); assertPhpWasmCallbackResultHistory(record);
	assert.deepEqual(record.updates.map(update => update.path), phpWasmCallbackResultModifiedPaths);
	assert.deepEqual(record.readerUpdates.map(update => update.path), phpWasmCallbackResultReaderPaths);
	assert.deepEqual(Object.keys(record.introducedSources), phpWasmCallbackResultIntroducedPaths);
});

test("PHP-Wasm callback-result history reconstructs integration and prior source bytes", async () => {
	const record = readPhpWasmCallbackResultHistory();
	for(const update of record.updates)
	{
		const current = beforePhpWasmCallbackResultAcceptance(update.path
			, await readFile(update.path), update.currentSha256);
		const previous = reversePhpWasmCallbackResultUpdate(current, update);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(beforePhpWasmCallbackResultAcceptance(update.path, current, update.currentSha256)
			, current, update.path);
		assert.equal(beforePhpWasmCallbackResultAcceptance(update.path, current, update.previousSha256)
			, previous, update.path);
	}
	for(const update of record.readerUpdates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = reversePhpWasmCallbackResultUpdate(current, update, "readerUpdates");
		assert.equal(sha256(previous), update.previousSha256, update.path);
	}
});

test("PHP-Wasm callback-result history binds introduced sources and preserves unknown bytes", async () => {
	const record = readPhpWasmCallbackResultHistory();
	for(const [path, identity] of Object.entries(record.introducedSources))
	{
		const source = await readFile(path);
		assert.equal(sha256(source), identity.currentSha256, path);
		const integrated = beforePhpWasmCallbackResultAcceptance(path
			, source, identity.integrationSha256);
		assert.equal(sha256(integrated), identity.integrationSha256, path);
	}
	const update = record.updates[0];
	const current = beforePhpWasmCallbackResultAcceptance(update.path
		, await readFile(update.path), update.currentSha256);
	const unknown = current + "\nunknown\n";
	assert.equal(beforePhpWasmCallbackResultAcceptance(update.path, unknown), unknown);
	assert.throws(() => reversePhpWasmCallbackResultUpdate(unknown, update));
});
