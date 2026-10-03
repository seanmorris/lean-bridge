/**
 * Historical fixture reconciliation rejects every unrecorded source change.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeWitCallbackRuntimeStaging } from "./helpers/wit-callback-runtime-staging-history.mjs";
import { copiedFixtureReaderHistoryPath, copiedFixtureReaderHistorySha256
	, beforeCopiedFixtureReaders, copiedFixtureHistoricalBytes
	, reverseCopiedFixtureReaderUpdate } from "./helpers/copied-fixture-source-history.mjs";
import { beforeOwnedJvmReceiverGc } from "./helpers/owned-jvm-receiver-gc-history.mjs";
import { beforeOwnedCallbackResults } from "./helpers/owned-callback-result-history.mjs";
import { assertDotnetVariantSourceHash } from "./helpers/dotnet-source-history.mjs";
import { assertRubyVariantSourceHash } from "./helpers/ruby-source-history.mjs";

const read = async () => {
	const bytes = await readFile(copiedFixtureReaderHistoryPath);
	assert.equal(sha256(bytes), copiedFixtureReaderHistorySha256);
	return JSON.parse(bytes);
};

test("copied fixture history authenticates the original WIT change and keeps both identities", async () => {
	const { fixture } = await read(), current = await readFile(fixture.path);
	assert.equal(sha256(await readFile(fixture.receipt)), fixture.receiptSha256);
	assert.equal(sha256(current), fixture.currentSha256);
	const previous = copiedFixtureHistoricalBytes(fixture.path, current, fixture.previousSha256);
	assert.equal(sha256(previous), fixture.previousSha256);
	assert.equal(copiedFixtureHistoricalBytes(fixture.path, current, fixture.currentSha256), current);
	assert.equal(copiedFixtureHistoricalBytes(fixture.path, previous, fixture.previousSha256), previous);
	// The shared history head must leave this transition to the original WIT reader.
	assert.equal(beforeCopiedFixtureReaders(fixture.path, current), current);
	assert.equal(beforeOwnedJvmReceiverGc(fixture.path, current), current);
	for(const changed of [current + "\n", current + current, ""
		, current.toString().replace("checks >= 100", "checks >= 1")
		, current.toString().replace("assert.equal(checks, fixture.expectedChecks)", "assert.ok(true)")
	]) {
		assert.equal(copiedFixtureHistoricalBytes(fixture.path, changed, fixture.previousSha256), changed);
		assert.notEqual(sha256(changed), fixture.previousSha256);
	}
	assert.equal(copiedFixtureHistoricalBytes("unknown.mjs", current, fixture.previousSha256), current);
	assert.notEqual(sha256(copiedFixtureHistoricalBytes(fixture.path, current, "0".repeat(64))), "0".repeat(64));
});

test("copied fixture readers reconstruct exact predecessor bytes and reject drift", async () => {
	const record = await read();
	assert.equal(record.updates.length, 25);
	assert.equal(new Set(record.updates.map(update => update.path)).size, record.updates.length);
	for(const update of record.updates)
	{
		const current = beforeOwnedCallbackResults(update.path, await readFile(update.path), update.currentSha256);
		const prior = beforeCopiedFixtureReaders(update.path, current);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeCopiedFixtureReaders(update.path, current, update.currentSha256), current);
		assert.equal(beforeCopiedFixtureReaders(update.path, prior, update.previousSha256), prior);
		assert.equal(beforeCopiedFixtureReaders(update.path, prior), prior);
		for(const changed of [current + "\n", current + current, ""
			, current.toString().replace(update.edits[0].current, update.edits[0].previous) + "\n"
		]) {
			assert.equal(beforeCopiedFixtureReaders(update.path, changed), changed);
			assert.notEqual(sha256(changed), update.previousSha256);
			assert.throws(() => reverseCopiedFixtureReaderUpdate(changed, update));
		}
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseCopiedFixtureReaderUpdate(current, changed));
		assert.equal(beforeCopiedFixtureReaders("unknown.mjs", current), current);
	}
});

test("legacy .NET and Ruby readers accept the WIT helper change without accepting altered checks", async () => {
	const { fixture } = await read(), current = await readFile(fixture.path);
	for(const verify of [assertDotnetVariantSourceHash, assertRubyVariantSourceHash])
	{
		verify(fixture.path, current, fixture.previousSha256);
		verify(fixture.path, current, fixture.currentSha256);
		assert.throws(() => verify(fixture.path, Buffer.from(current + "\n"), fixture.previousSha256));
		assert.throws(() => verify(fixture.path, current, "0".repeat(64)));
		assert.throws(() => verify("unknown.mjs", current, fixture.previousSha256));
	}
});

test("the reader repair preserves immutable WIT and JVM GC evidence", async () => {
	assert.equal(sha256(await readFile("docs/evidence/wit-owned-receivers-20261001.json")), "d8621ed8b0744f9a9ac9bb5ddb1da200b3f7b85f5bab801a54c248e4b36e0262");
	assert.equal(sha256(await readFile("docs/evidence/owned-jvm-receiver-gc-20261001.json")), "aa71717e00fa100a2a7c8a8bb2c54a69f99b9a31f2d780ea94480b638d2444fc");
});

test("the reader repair refreshes source identities without changing support claims", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const previous = JSON.parse(beforeCopiedFixtureReaders(path, source));
	for(const evidence of previous.evidence) for(const file of evidence.files)
		file.sha256 = sha256(beforeWitCallbackRuntimeStaging(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(source), previous);
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(copiedFixtureHistoricalBytes("unrelated.bin", binary), binary);
});
