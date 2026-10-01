/**
 * Reject incomplete native PHP receiver acceptance and unsupported scope claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedPhpReceiverExecution } from "./helpers/owned-php-receiver-package-evidence.mjs";
import { ownedPhpReceiverPath, ownedPhpReceiverBaseline, ownedPhpReceiverPrevious
	, ownedPhpReceiverChangedPaths, ownedPhpReceiverAddedPaths
	, beforeOwnedPhpReceiver, reverseOwnedPhpReceiverUpdate } from "./helpers/owned-php-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPhpReceiverPath, "utf8"));

test("native PHP receiver evidence binds exact sources and preserves historical support cells", async () => {
	const record = await read();
	assert.equal(record.kind, "owned-php-receivers"); assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedPhpReceiverBaseline); assert.deepEqual(record.previous, ownedPhpReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPhpReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(item => item.path), ownedPhpReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]); assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedPhpReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256); assert.equal(beforeOwnedPhpReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedPhpReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedPhpReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPhpReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedPhpReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedPhpReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["owned-php-receivers"
		, "owned-php-receiver-packaging"
		, "owned-php-receiver-resource-packaging"
		, "owned-php-receiver-documentation"
		, "owned-php-receiver-ci", "owned-php-receiver-evidence"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("native PHP receiver evidence requires installed packages from both author paths", async () => {
	await assertOwnedPhpReceiverExecution(await read());
});

test("native PHP receiver evidence rejects incomplete runs and inflated package claims", async () => {
	const record = await read();
	// An invalid baseline must not make all negative cases pass trivially.
	await assertOwnedPhpReceiverExecution(record);
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.wasm = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].weakObserved.live++; }
		, value => { value.runtime[1].observed.identities++; }
		, value => { value.runtime[0].observed.faults.move.php.after--; }
		, value => { value.runtime[0].mutants.pop(); }
		, value => { value.runtime[0].mutants[0].parsed = false; }
		, value => { value.runtime[0].mutants[0].semanticRejection = false; }
		, value => { value.runtime[0].nativeSourceSha256 = "0".repeat(64); }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].observed.live++; }
		, value => { value.plain[0].retired.checks--; }
		, value => { value.plain[0].retiredConsumerSha256 = "0".repeat(64); }
		, value => { value.plain[2].consuming = false; }
		, value => { value.unanchored.pop(); }
		, value => { value.unanchored[0].resultAnchors = true; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[1].independentBuild = false; }
		, value => { value.packages[0].cliBuilds.pop(); }
		, value => { value.packages[0].cliInstallation.sourceRemoved = false; }
		, value => { value.packages[0].adapterReceipt.phpValues.receiverExports.properties = "mutable-fields"; }
		, value => { value.packages[0].adapterReceipt.phpValues.receiverExports.resourceEquality = "wrapper-identity"; }
		, value => { delete value.packages[0].adapterReceipt.phpValues.receiverExports.exports[0].kind; }
		, value => { value.packages[0].tamperRejected.pop(); }
		, value => { value.packages[0].observations.pop(); }
		, value => { delete value.packages[0].observations[2].loader; }
		, value => { value.packages[0].observations[2].loader.liveIdentities++; }
		, value => { value.packages[0].observations[2].loader.privateGmp = false; }
		, value => { value.packages[0].observations[2].loader.automaticShutdown = false; }
		, value => { value.packages[0].loaderRejected.pop(); }
		, value => { value.packages[0].coldValidationWithoutFfi = false; }
		, value => { value.resourcePackages.pop(); }
		, value => { value.resourcePackages[0].producerInterface = "installed-cli"; }
		, value => { value.resourcePackages[0].hostCallbacks = true; }
		, value => { value.resourcePackages[0].sourceRemovedBeforeInstallation = false; }
		, value => { value.resourcePackages[0].deterministicReassembly = false; }
		, value => { value.resourcePackages[1].observations[1].observed.checks--; }
		, value => { value.documentation.handoffRemoved = false; }
		, value => { value.documentation.observations.pop(); }
		, value => { value.documentation.observations[0].observed.stdout = "42\n42\n42\n"; }
		, value => { value.documentation.sourceHashes.example = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPhpReceiverExecution(changed), undefined, mutate.toString());
	}
});
