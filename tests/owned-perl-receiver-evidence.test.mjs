/**
 * Reject incomplete Perl receiver executions and unsupported lifetime claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedPhpReceiver, ownedPhpReceiverHistoricalBytes } from "./helpers/owned-php-receiver-history.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedPerlReceiverExecution } from "./helpers/owned-perl-receiver-package-evidence.mjs";
import { ownedPerlReceiverPath, ownedPerlReceiverBaseline, ownedPerlReceiverPrevious
	, ownedPerlReceiverChangedPaths, ownedPerlReceiverAddedPaths
	, beforeOwnedPerlReceiver, reverseOwnedPerlReceiverUpdate } from "./helpers/owned-perl-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPerlReceiverPath, "utf8"));

test("Perl receiver evidence binds exact sources and preserves historical support cells", async () => {
	const record = await read();
	assert.equal(record.kind, "owned-perl-receivers"); assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedPerlReceiverBaseline); assert.deepEqual(record.previous, ownedPerlReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPerlReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedPhpReceiverHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(item => item.path), ownedPerlReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]); assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedPhpReceiver(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const prior = beforeOwnedPerlReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256); assert.equal(beforeOwnedPerlReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedPerlReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedPerlReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPerlReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedPerlReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedPhpReceiver(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedPerlReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedPhpReceiverHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["core", "plain", "unanchored", "contract", "packaging"
		, "resource-packaging", "documentation", "ci", "evidence"])
		assert.equal(classifyRepositoryTest(`tests/owned-perl-receiver-${name}.test.mjs`), "contract");
});

test("Perl receiver evidence requires all four ABIs and both installed author paths", async () => {
	await assertOwnedPerlReceiverExecution(await read());
});

test("Perl receiver evidence rejects incomplete runs and inflated package claims", async () => {
	const record = await read();
	// Prove the positive baseline before expecting altered evidence to fail.
	await assertOwnedPerlReceiverExecution(record);
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].observations.pop(); }
		, value => { value.runtime[0].observations[0].restored = false; }
		, value => { value.runtime[1].observations[0].observed.identities++; }
		, value => { value.runtime[0].observations[0].rejectedMutations.pop(); }
		, value => { value.runtime[0].observations[0].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].xsSha256 = "0".repeat(64); }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].observations[0].observed.managedLive++; }
		, value => { value.plain[2].consuming = false; }
		, value => { value.unanchored.pop(); }
		, value => { value.unanchored[0].resultAnchors = true; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].producerRemoved = false; }
		, value => { value.packages[1].independentProducerBuild = false; }
		, value => { value.packages[0].cliBuilds.pop(); }
		, value => { value.packages[0].cliInstallation.sourceRemoved = false; }
		, value => { value.packages[0].owned.receiverExports.properties = "mutable-fields"; }
		, value => { value.packages[0].tamperRejections.pop(); }
		, value => { value.packages[0].observations.pop(); }
		, value => { value.packages[0].observations[0].runtimeOnlyRuns = 1; }
		, value => { value.packages[0].observations[0].assets.observations.pop(); }
		, value => { value.packages[0].observations[1].observed.brokerIdentities++; }
		, value => { value.packages[1].manifest.prebuilt.pop(); }
		, value => { value.resourcePackages.pop(); }
		, value => { value.resourcePackages[0].producerInterface = "installed-cli"; }
		, value => { value.resourcePackages[0].hostCallbacks = true; }
		, value => { value.resourcePackages[1].observations[1].observed.checks--; }
		, value => { value.documentation.handoffRemoved = false; }
		, value => { value.documentation.observations.pop(); }
		, value => { value.documentation.sourceHashes.example = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPerlReceiverExecution(changed), undefined, mutate.toString());
	}
});
