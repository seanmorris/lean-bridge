/**
 * Preserve immutable predecessor evidence during staged JVM callback support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedPerlCallbackResults } from "./helpers/owned-perl-callback-result-history.mjs";
import { ownedJvmCallbackHistoryPath, ownedJvmCallbackHistorySha256
	, ownedJvmCallbackBaseline, ownedJvmCallbackChangedPaths
	, beforeOwnedJvmCallbackResults, reverseOwnedJvmCallbackUpdate } from "./helpers/owned-jvm-callback-result-history.mjs";
import "./helpers/owned-jvm-callback-result-acceptance-tests.mjs";
import "./helpers/owned-perl-callback-result-history-tests.mjs";

test("JVM callback source history authenticates complete transitions and rejects drift", async () => {
	const wrapper = await readFile("tests/owned-jvm-callback-result-history.test.mjs", "utf8");
	assert.match(wrapper, /^import "\.\/helpers\/owned-jvm-callback-result-acceptance-tests\.mjs";$/mu);
	assert.match(wrapper, /^import "\.\/helpers\/owned-perl-callback-result-history-tests\.mjs";$/mu);
	const bytes = await readFile(ownedJvmCallbackHistoryPath);
	assert.equal(sha256(bytes), ownedJvmCallbackHistorySha256);
	const history = JSON.parse(bytes);
	assert.equal(history.baselineRevision, ownedJvmCallbackBaseline);
	assert.equal(sha256(await readFile(history.previous.path)), history.previous.sha256);
	assert.deepEqual(history.updates.map(update => update.path), ownedJvmCallbackChangedPaths);
	assert.equal(history.acceptance, undefined); assert.equal(history.scope, undefined);
	for(const update of history.updates)
	{
		const current = Buffer.from(beforeOwnedPerlCallbackResults(update.path, await readFile(update.path)));
		const prior = beforeOwnedJvmCallbackResults(update.path, current);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedJvmCallbackResults(update.path, current, update.currentSha256), current);
		assert.equal(beforeOwnedJvmCallbackResults(update.path, prior), prior);
		for(const unknown of [current + "\n", current + current, ""])
		{
			assert.equal(beforeOwnedJvmCallbackResults(update.path, unknown), unknown);
			assert.throws(() => reverseOwnedJvmCallbackUpdate(unknown, update));
		}
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJvmCallbackUpdate(current, changed));
		assert.equal(beforeOwnedJvmCallbackResults("unknown.mjs", current), current);
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(beforeOwnedJvmCallbackResults("unrelated.bin", binary), binary);
});

test("staged JVM source identities do not promote type-surface support", async () => {
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const previous = JSON.parse(beforeOwnedJvmCallbackResults(path, current));
	for(const evidence of previous.evidence) for(const file of evidence.files)
		file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), previous);
});
