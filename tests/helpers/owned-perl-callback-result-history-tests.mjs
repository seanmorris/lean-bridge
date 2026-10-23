/**
 * Keep staged Perl ownership work separate from completed JVM acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { selectCliPackageConfig } from "./cli-package-config-history.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { ownedJvmCallbackEvidencePath } from "./owned-jvm-callback-result-acceptance.mjs";
import { combinedCliBundleExtras } from "./owned-jvm-callback-result-combined-evidence.mjs";
import { ownedPerlCallbackHistoryPath, ownedPerlCallbackHistorySha256
	, ownedPerlCallbackBaseline, ownedPerlCallbackChangedPaths
	, ownedPerlCallbackPrevious, ownedPerlCallbackCompletedPredecessor
	, ownedPerlCallbackProducer, beforeOwnedPerlCallbackResults
	, reverseOwnedPerlCallbackUpdate } from "./owned-perl-callback-result-history.mjs";
import { bytesAtProducer, sourceAtProducer } from "./producer-source.mjs";

test("Perl callback source history authenticates complete transitions and rejects drift", async () => {
	assert.match(await readFile("tests/owned-perl-xs.test.mjs", "utf8")
		, /^import "\.\/helpers\/owned-perl-callback-result-history-tests\.mjs";$/mu);
	const bytes = await readFile(ownedPerlCallbackHistoryPath);
	assert.equal(sha256(bytes), ownedPerlCallbackHistorySha256);
	const history = JSON.parse(bytes);
	assert.equal(history.baselineRevision, ownedPerlCallbackBaseline);
	assert.deepEqual(history.previous, ownedPerlCallbackPrevious);
	assert.deepEqual(history.completedPredecessor, ownedPerlCallbackCompletedPredecessor);
	for(const predecessor of [history.previous, history.completedPredecessor])
		assert.equal(sha256(await readFile(predecessor.path)), predecessor.sha256);
	assert.deepEqual(history.updates.map(update => update.path), ownedPerlCallbackChangedPaths);
	assert.equal(history.acceptance, undefined); assert.equal(history.scope, undefined);
	for(const update of history.updates)
	{
		const current = Buffer.from(sourceAtProducer(
			ownedPerlCallbackProducer, update.path, update.currentSha256
		));
		const prior = beforeOwnedPerlCallbackResults(
			update.path, current, update.previousSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedPerlCallbackResults(update.path, current, update.currentSha256), current);
		assert.equal(beforeOwnedPerlCallbackResults(update.path, current, update.previousSha256), prior);
		assert.equal(beforeOwnedPerlCallbackResults(
			update.path, prior, update.previousSha256
		), prior);
		for(const unknown of [current + "\n", current + current, "", Buffer.from([0, 255, 128, 192])])
		{
			assert.equal(beforeOwnedPerlCallbackResults(update.path, unknown), unknown);
			assert.throws(() => reverseOwnedPerlCallbackUpdate(unknown, update));
		}
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, edits: [{ ...update.edits[0], start: update.edits[0].start + 1 }] }
			, { ...update, unrecorded: true }])
			assert.throws(() => reverseOwnedPerlCallbackUpdate(current, changed));
		assert.equal(beforeOwnedPerlCallbackResults("unknown.mjs", current), current);
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(beforeOwnedPerlCallbackResults("unrelated.bin", binary), binary);
});

test("staged Perl source identities do not promote type-surface support", async () => {
	const path = "docs/type-surface.v1.json";
	const history = JSON.parse(await readFile(ownedPerlCallbackHistoryPath));
	const update = history.updates.find(item => item.path === path);
	assert.ok(update);
	const current = sourceAtProducer(
		ownedPerlCallbackProducer, path, update.currentSha256
	);
	const previous = JSON.parse(beforeOwnedPerlCallbackResults(
		path, current, update.previousSha256
	));
	for(const evidence of previous.evidence) for(const file of evidence.files)
		file.sha256 = sha256(bytesAtProducer(
			ownedPerlCallbackProducer, file.path
		));
	assert.deepEqual(JSON.parse(current), previous);
});

test("frozen JVM CLI reports reject current Perl source inventories without rewriting originals", async () => {
	const record = JSON.parse(await readFile(ownedJvmCallbackEvidencePath, "utf8"));
	const reports = unpackOwnedCallbackReports(record.archive);
	const addedModule = "src/backends/perl/owned-callback-arguments.mjs";
	const readSource = async path => sourceAtProducer(
		ownedPerlCallbackProducer, path
	);
	for(const name of ["ordinary-combined-package", "ordinary-combined-release"])
	{
		const path = `build/owned-jvm-callback-results/${name}.json`;
		const item = reports[path], original = structuredClone(item);
		assert.ok(item);
		await assert.rejects(() => selectCliPackageConfig(
			item.cli, readSource, { extras: combinedCliBundleExtras }
		), error => {
			assert.equal(error.code, "ERR_ASSERTION"); assert.equal(error.operator, "deepStrictEqual");
			assert.ok(Array.isArray(error.actual)); assert.ok(Array.isArray(error.expected));
			assert.ok(!error.actual.includes(addedModule)); assert.ok(error.expected.includes(addedModule));
			return true;
		});
		assert.deepEqual(item, original);
	}
});
