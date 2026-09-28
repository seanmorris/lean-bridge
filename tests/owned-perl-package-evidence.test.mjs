/**
 * Reject forged owned CPAN acceptance and preserve immutable predecessor records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedPerlExecution } from "./helpers/owned-perl-package-evidence.mjs";
import { beforeOwnedPerlPackages, ownedPerlBaseline, ownedPerlChangedPaths
	, ownedPerlAddedPaths, ownedPerlHistoricalBytes, ownedPerlHistoryPath
	, reverseOwnedPerlUpdate } from "./helpers/owned-perl-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("owned Perl preserves published sources and rejects unrecorded edits", async () => {
	const record = await json(ownedPerlHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-perl-package-integration");
	assert.equal(record.baselineRevision, ownedPerlBaseline);
	assert.deepEqual(record.previous, { path: "docs/evidence/jvm-recursive-probe-repair-20260927.json"
		, sha256: "72c19a081545adbb2612f033f3051bbddca3ce1b322c12eb656ad84956ac9f78" });
	assert.equal(sha256(await readFile(record.previous.path)), record.previous.sha256);
	const previous = await json("docs/evidence/owned-jvm-integration-20260927.json");
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([
		...Object.keys(previous.sources), ...ownedPerlChangedPaths
		, ...ownedPerlAddedPaths
	])].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedPerlChangedPaths);
	for(const [path, hash] of Object.entries(record.sources))
		assert.equal(sha256(await readFile(path)), hash, path);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		const prior = beforeOwnedPerlPackages(update.path, current);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedPerlPackages(update.path, prior), prior);
		assert.equal(beforeOwnedPerlPackages(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded Perl change */\n";
		assert.equal(beforeOwnedPerlPackages(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPerlUpdate(unknown, update));
		assert.throws(() => reverseOwnedPerlUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedPerlUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedPerlHistoricalBytes("unrelated.bin", binary), binary);
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const expected = JSON.parse(beforeOwnedPerlPackages("docs/type-surface.v1.json", current));
	for(const evidence of expected.evidence) for(const file of evidence.files)
		file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), expected);
});

test("owned Perl evidence binds CLI, installed APIs, authentication and independent reproduction", async () => {
	await assertOwnedPerlExecution(await json(ownedPerlHistoryPath));
});

test("owned Perl evidence rejects widened scope and forged installed observations", async () => {
	const original = await json(ownedPerlHistoryPath);
	for(const change of [
		record => { record.scope.wasm = true; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.runs.packages.command += " --import forged.mjs"; }
		, record => { record.runs.runtime.text += "\nchanged\n"; }
		, record => { record.packages.ordinary.cliIntegrated = false; }
		, record => { record.packages.reviewed.producerRemoved = false; }
		, record => { record.packages.ordinary.observations.pop(); }
		, record => { record.packages.ordinary.observations[0].observed.checks--; }
		, record => { record.packages["callbacks-reviewed"].observations[0].observed.primitives--; }
		, record => { record.packages.ordinary.observations[0].assets.observations.pop(); }
		, record => { record.packages.ordinary.observations[0].assets.observations[0].brokerIdentities = 1; }
		, record => { record.packages.ordinary.packageSetReceipt.packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, record => { record.documentation.sourceHashes.example = "0".repeat(64); }
		, record => { record.documentation.observations[0].stdout = "wrong\n"; }
		, record => { record.coexistence.reproduced.independentNativeCompilation = false; }
		, record => { record.coexistence.observations[0].observed.foreignRejections--; }
		, record => { record.coexistence.observations[0].observed.snapshot.live_identities = 1; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedPerlExecution(changed), change.toString());
	}
});
