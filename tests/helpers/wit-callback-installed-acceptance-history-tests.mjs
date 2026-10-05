/**
 * Verify installed-WIT callback acceptance source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertWitCallbackInstalledHistory, beforeWitCallbackInstalledAcceptance
	, readWitCallbackInstalledHistory, reverseWitCallbackInstalledUpdate
	, witCallbackInstalledBaseline, witCallbackInstalledIntegration
	, witCallbackInstalledIntroducedPaths, witCallbackInstalledModifiedPaths
	, witCallbackInstalledReaderPaths } from "./wit-callback-installed-acceptance-history.mjs";

const at = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("installed WIT callback history closes implementation, receipt and readers", () => {
	const record = readWitCallbackInstalledHistory(); assertWitCallbackInstalledHistory(record);
	assert.deepEqual(record.updates.map(update => update.path), witCallbackInstalledModifiedPaths);
	assert.deepEqual(record.readerUpdates.map(update => update.path), witCallbackInstalledReaderPaths);
	assert.deepEqual(Object.keys(record.introducedSources), witCallbackInstalledIntroducedPaths);
});

test("installed WIT callback history reconstructs integration and prior source bytes", async () => {
	const record = readWitCallbackInstalledHistory();
	for(const update of record.updates)
	{
		const current = at(witCallbackInstalledIntegration, update.path);
		const previous = at(witCallbackInstalledBaseline, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseWitCallbackInstalledUpdate(current, update), previous, update.path);
		assert.equal(beforeWitCallbackInstalledAcceptance(update.path, current, update.currentSha256)
			, current, update.path);
		assert.equal(beforeWitCallbackInstalledAcceptance(update.path, current, update.previousSha256)
			, previous, update.path);
	}
	for(const update of record.readerUpdates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = at(witCallbackInstalledIntegration, update.path);
		assert.equal(reverseWitCallbackInstalledUpdate(current, update, "readerUpdates")
			, previous, update.path);
	}
});

test("installed WIT callback history preserves unknown successors", async () => {
	const record = readWitCallbackInstalledHistory(), update = record.updates[0];
	const current = at(witCallbackInstalledIntegration, update.path), unknown = current + "\nunknown\n";
	assert.equal(beforeWitCallbackInstalledAcceptance(update.path, unknown), unknown);
	assert.throws(() => reverseWitCallbackInstalledUpdate(unknown, update));
	assert.deepEqual(beforeWitCallbackInstalledAcceptance("unknown.mjs", await readFile(update.path))
		, await readFile(update.path));
});
