/**
 * Authenticate receiver source history and reject incomplete execution claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedReceiverExecution } from "./helpers/owned-receiver-evidence.mjs";
import { assertOwnedReceiverCi, ownedReceiverReports } from "./helpers/owned-receiver-ci.mjs";
import { ownedReceiverPath, ownedReceiverBaseline, ownedReceiverPrevious
	, ownedReceiverChangedPaths, ownedReceiverAddedPaths
	, beforeOwnedReceiver, reverseOwnedReceiverUpdate } from "./helpers/owned-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedReceiverPath, "utf8"));

test("receiver evidence preserves immutable source history without support promotions", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-receivers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedReceiverBaseline);
	assert.deepEqual(record.previous, ownedReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedReceiverAddedPaths].sort());
	for(const [path, identity] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), identity, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedReceiverUpdate(unknown, update));
		for(const altered of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedReceiverUpdate(source, altered));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["owned-receiver-analysis", "owned-receiver-packaging", "owned-receiver-plain", "owned-receiver-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("receiver evidence requires real Lean and both installed source paths", async () => {
	await assertOwnedReceiverExecution(await read());
});

test("receiver evidence rejects incomplete runtime, package and CI claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.otherReceiverProjections = true; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.run.text = value.run.text.replace('"checks":3277', '"checks":3278'); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].model.ownedGraph.resultAnchors = {}; }
		, value => { value.plain[1].result.identities++; }
		, value => { value.runtime[0].model.ownedGraph.receiverExports.exports.pop(); }
		, value => { value.runtime[0].probeSha256 = "0".repeat(64); }
		, value => { value.runtime[1].result.identities++; }
		, value => { value.runtime[1].result.beforeFailures = 0; }
		, value => { value.runtime[0].mutations.pop(); }
		, value => { value.runtime[0].rejected.pop(); }
		, value => { value.runtime[1].reviewedMismatchRejected = false; }
		, value => { value.packages[0].cliRemovedBeforeConsumerInstall = false; }
		, value => { value.packages[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages[1].cliInstallation.filesVerified--; }
		, value => { value.packages[1].builds.pop(); }
		, value => { value.packages[0].independentRebuild = false; }
		, value => { value.packages[1].documentation.stdout = "42\n"; }
		, value => { value.packages[1].rejected--; }
		, value => { value.packages[1].adapter.ownedValues.receiverExports.exports[0].argument = 1; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedReceiverExecution(changed), undefined, mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedReceiverCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-receivers > build/owned-receivers.log 2>&1"
		, "          rg '^# skipped 0$' build/owned-receivers.log"
		, ...ownedReceiverReports.map(path => "          test -s " + path)
		, "            build/owned-receivers/"
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedReceiverCi(workflow.replace(line + "\n", ""), manifest));
	}
	assert.throws(() => assertOwnedReceiverCi(workflow, { ...manifest, scripts: {
		...manifest.scripts, "test:owned-receivers": manifest.scripts["test:owned-receivers"].replace("=1", "=0") } }));
});
