/**
 * Verify PHP-Wasm callback-result acceptance source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPhpWasmCallbackResultHistory, beforePhpWasmCallbackResultAcceptance
	, phpWasmCallbackResultBaseline, phpWasmCallbackResultIntegration
	, phpWasmCallbackResultIntroducedPaths, phpWasmCallbackResultModifiedPaths
	, phpWasmCallbackResultReaderPaths, readPhpWasmCallbackResultHistory
	, reversePhpWasmCallbackResultUpdate } from "./php-wasm-callback-result-acceptance-history.mjs";

const at = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

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
		const current = at(phpWasmCallbackResultIntegration, update.path);
		const previous = at(phpWasmCallbackResultBaseline, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reversePhpWasmCallbackResultUpdate(current, update), previous, update.path);
		assert.equal(beforePhpWasmCallbackResultAcceptance(update.path, current, update.currentSha256)
			, current, update.path);
		assert.equal(beforePhpWasmCallbackResultAcceptance(update.path, current, update.previousSha256)
			, previous, update.path);
	}
	for(const update of record.readerUpdates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = at(phpWasmCallbackResultIntegration, update.path);
		assert.equal(reversePhpWasmCallbackResultUpdate(current, update, "readerUpdates")
			, previous, update.path);
	}
});

test("PHP-Wasm callback-result history binds introduced sources and preserves unknown bytes", async () => {
	const record = readPhpWasmCallbackResultHistory();
	for(const [path, identity] of Object.entries(record.introducedSources))
	{
		assert.equal(sha256(at(phpWasmCallbackResultIntegration, path)), identity.integrationSha256);
		const current = beforePhpWasmCallbackResultAcceptance(path
			, await readFile(path), identity.integrationSha256);
		assert.equal(sha256(current), identity.integrationSha256, path);
	}
	const update = record.updates[0], current = at(phpWasmCallbackResultIntegration, update.path);
	const unknown = current + "\nunknown\n";
	assert.equal(beforePhpWasmCallbackResultAcceptance(update.path, unknown), unknown);
	assert.throws(() => reversePhpWasmCallbackResultUpdate(unknown, update));
});
