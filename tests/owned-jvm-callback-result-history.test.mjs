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
import "./helpers/staged-php-producer-replay-repair-source-history-tests.mjs";
import "./helpers/callback-staging-lineage-replay-repair-source-history-tests.mjs";
import "./helpers/callback-staging-producer-replay-repair-source-history-tests.mjs";
import "./helpers/owned-jvm-callback-result-acceptance-tests.mjs";
import "./helpers/owned-perl-callback-result-history-tests.mjs";
import "./helpers/post-perl-callback-staging-history-tests.mjs";
import "./helpers/wit-callback-runtime-staging-history-tests.mjs";
import "./helpers/php-callback-installed-staging-history-tests.mjs";
import "./helpers/owned-php-callback-result-runtime-evidence-tests.mjs";

test("JVM callback source history authenticates complete transitions and rejects drift", async () => {
	const wrapper = await readFile("tests/owned-jvm-callback-result-history.test.mjs", "utf8");
	assert.match(wrapper, /^import "\.\/helpers\/owned-jvm-callback-result-acceptance-tests\.mjs";$/mu);
	assert.match(wrapper, /^import "\.\/helpers\/owned-perl-callback-result-history-tests\.mjs";$/mu);
	assert.match(wrapper, /^import "\.\/helpers\/post-perl-callback-staging-history-tests\.mjs";$/mu);
	assert.match(wrapper, /^import "\.\/helpers\/wit-callback-runtime-staging-history-tests\.mjs";$/mu);
	assert.match(wrapper, /^import "\.\/helpers\/php-callback-installed-staging-history-tests\.mjs";$/mu);
	assert.match(wrapper, /^import "\.\/helpers\/owned-php-callback-result-runtime-evidence-tests\.mjs";$/mu);
	const bytes = await readFile(ownedJvmCallbackHistoryPath);
	assert.equal(sha256(bytes), ownedJvmCallbackHistorySha256);
	const history = JSON.parse(bytes);
	assert.equal(history.baselineRevision, ownedJvmCallbackBaseline);
	assert.equal(sha256(await readFile(history.previous.path)), history.previous.sha256);
	assert.deepEqual(history.updates.map(update => update.path), ownedJvmCallbackChangedPaths);
	assert.equal(history.acceptance, undefined); assert.equal(history.scope, undefined);
	for(const update of history.updates)
	{
		const current = Buffer.from(beforeOwnedPerlCallbackResults(update.path, await readFile(update.path), update.currentSha256));
		const prior = beforeOwnedJvmCallbackResults(
			update.path, current, update.previousSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedJvmCallbackResults(update.path, current, update.currentSha256), current);
		assert.equal(beforeOwnedJvmCallbackResults(
			update.path, prior, update.previousSha256
		), prior);
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
	const history = JSON.parse(await readFile(ownedJvmCallbackHistoryPath, "utf8"));
	const updates = new Map(history.updates.map(update => [update.path, update]));
	const path = "docs/type-surface.v1.json";
	const update = updates.get(path);
	const current = beforeOwnedPerlCallbackResults(path, await readFile(path, "utf8"), update.currentSha256);
	const previous = JSON.parse(beforeOwnedJvmCallbackResults(path, current, update.previousSha256));
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const expected = updates.get(file.path)?.currentSha256 ?? file.sha256;
		file.sha256 = sha256(beforeOwnedPerlCallbackResults(file.path, await readFile(file.path), expected));
	}
	assert.deepEqual(JSON.parse(current), previous);
});
