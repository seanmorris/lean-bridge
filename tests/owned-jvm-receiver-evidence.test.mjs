/**
 * Authenticate JVM receivers without accepting incomplete installed-package runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedJvmReceiverExecution } from "./helpers/owned-jvm-receiver-evidence.mjs";
import { assertOwnedJvmReceiverCi, ownedJvmReceiverReports } from "./helpers/owned-jvm-receiver-ci.mjs";
import { authenticateFinHistoryRecordSources, bytesAtFinHistoryRecordSource }
	from "./helpers/source-at-fin-history-milestone.mjs";
import "./helpers/jvm-shard-ci-tests.mjs";
import "./helpers/jvm-producer-replay-repair-source-history-tests.mjs";
import { ownedJvmReceiverPath, ownedJvmReceiverBaseline, ownedJvmReceiverPrevious
	, ownedJvmReceiverChangedPaths, ownedJvmReceiverAddedPaths
	, beforeOwnedJvmReceiver, reverseOwnedJvmReceiverUpdate } from "./helpers/owned-jvm-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJvmReceiverPath, "utf8"));

// The receiver record authenticates the sources its .NET predecessor recorded plus its
// own additions. Its milestone inventory also pins 854 files (1,627 occurrences) that
// neither record ever owned; that set is closed, and their pins must stay unchanged.
const ownedJvmReceiverUnownedInventory = Object.freeze({
	paths: 854
	, sha256: "0de30b1254976b9a588bcff7d677802ee09c4368685de494f1996843ff1c7323"
});

/**
 * Restore the record's authenticated pins and return the inventory paths it does not own.
 *
 * @param prior - Reconstructed predecessor inventory, updated in place.
 * @param sources - Record-owned source digests.
 */
const restoreOwnedJvmReceiverPins = (prior, sources) => {
	const unowned = new Set();
	for(const evidence of prior.evidence) for(const file of evidence.files)
	{
		const digest = sources[file.path];
		if(digest === undefined)
		{
			unowned.add(file.path);
			continue;
		}
		assert.equal(typeof digest, "string", file.path);
		file.sha256 = digest;
	}
	return [...unowned].sort();
};

/**
 * Require exactly the closed set of inventory paths that neither receiver record owns.
 *
 * @param paths - Sorted unowned inventory paths.
 */
const assertOwnedJvmReceiverUnownedInventory = paths => {
	assert.equal(paths.length, ownedJvmReceiverUnownedInventory.paths);
	assert.equal(sha256(paths.join("\n")), ownedJvmReceiverUnownedInventory.sha256);
};

test("JVM receiver evidence binds exact sources and preserves historical support cells", async () => {
	const record = await read();
	assert.equal(record.kind, "owned-jvm-receivers"); assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedJvmReceiverBaseline); assert.deepEqual(record.previous, ownedJvmReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedJvmReceiverAddedPaths].sort());
	assert.equal(authenticateFinHistoryRecordSources(
		ownedJvmReceiverPath, record.sources), true);
	assert.deepEqual(record.updates.map(item => item.path), ownedJvmReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]); assert.equal(update.currentSha256, record.sources[update.path]);
		const source = (await bytesAtFinHistoryRecordSource(
			ownedJvmReceiverPath, update.path)).toString();
		const prior = beforeOwnedJvmReceiver(update.path, source, update.previousSha256);
		assert.equal(sha256(prior), update.previousSha256); assert.equal(beforeOwnedJvmReceiver(update.path, prior, update.previousSha256), prior);
		assert.equal(beforeOwnedJvmReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedJvmReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJvmReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedJvmReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json";
	const current = (await bytesAtFinHistoryRecordSource(
		ownedJvmReceiverPath, path)).toString();
	const prior = JSON.parse(beforeOwnedJvmReceiver(path, current, previous.sources[path]));
	const pristine = structuredClone(prior);
	const unowned = restoreOwnedJvmReceiverPins(prior, record.sources);
	assertOwnedJvmReceiverUnownedInventory(unowned);
	assert.ok(unowned.every(item => !Object.hasOwn(previous.sources, item)));
	// Unowned pins are not rewritten, so this also proves every one of them is unchanged.
	assert.deepEqual(JSON.parse(current), prior);
	// Any other unowned inventory file, or an owned source dropped from the record, fails.
	const added = structuredClone(pristine);
	added.evidence[0].files.push({ path: "docs/evidence/unowned-probe.json", sha256: "0".repeat(64) });
	assert.throws(() => assertOwnedJvmReceiverUnownedInventory(
		restoreOwnedJvmReceiverPins(added, record.sources)), assert.AssertionError);
	const owned = Object.keys(record.sources).find(item => prior.evidence.some(
		evidence => evidence.files.some(file => file.path === item)));
	assert.ok(owned);
	const dropped = { ...record.sources }; delete dropped[owned];
	assert.throws(() => assertOwnedJvmReceiverUnownedInventory(
		restoreOwnedJvmReceiverPins(structuredClone(pristine), dropped)), assert.AssertionError);
	for(const name of ["core", "plain", "unanchored", "packaging", "resource-packaging", "evidence"])
		assert.equal(classifyRepositoryTest(`tests/owned-jvm-receiver-${name}.test.mjs`), "contract");
});

test("JVM receiver evidence requires direct and installed packages from both author paths", async () => {
	await assertOwnedJvmReceiverExecution(await read());
});

test("JVM receiver evidence rejects incomplete runs and unsupported lifetime claims", async () => {
	const record = await read();
	// A missing successful baseline must not make every negative trivially pass.
	assert.equal(record.acceptance, "passed");
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.optimizedNominalReceiverGc = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].restored = false; }
		, value => { value.runtime[1].observed.identities++; }
		, value => { value.runtime[0].rejectedMutations.pop(); }
		, value => { value.runtime[0].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].compileRejections.pop(); }
		, value => { value.plain.pop(); }
		, value => { value.plain[0].observed.identities++; }
		, value => { value.plain[2].consuming = false; }
		, value => { value.unanchored.pop(); }
		, value => { value.unanchored[0].resultAnchors = true; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceRemovedBeforeInstallation = false; }
		, value => { value.packages[1].independentProducerBuild = false; }
		, value => { value.packages[0].cliBuilds.pop(); }
		, value => { value.packages[0].cliInstallation.sourceRemoved = false; }
		, value => { value.packages[0].adapter.jvmValues.receiverExports.properties = "mutable-fields"; }
		, value => { value.packages[0].compiled.kotlin.options.pop(); }
		, value => { value.packages[0].tamperRejections.pop(); }
		, value => { value.packages[0].observations[0].jvm.documentation.pop(); }
		, value => { value.packages[0].observations[0].jvm.runtimeOnlyExecution = false; }
		, value => { value.packages[0].observations[0].jvm.inspection.scenarios.pop(); }
		, value => { value.packages[0].observations[1].checks--; }
		, value => { value.packages[1].companions.ruby.checks = 0; }
		, value => { value.resourcePackages.pop(); }
		, value => { value.resourcePackages[0].producerInterface = "installed-cli"; }
		, value => { value.resourcePackages[0].hostCallbacks = true; }
		, value => { value.resourcePackages[1].observations[1].jvm.repeatExecution = false; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedJvmReceiverExecution(changed), undefined, mutate.toString());
	}
});

test("JVM receiver CI retains complete gates, explicit tools and all twelve reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedJvmReceiverCi(workflow, manifest);
	for(const before of [
		"          npm run test:owned-jvm-receivers > build/owned-jvm-receivers.log 2>&1\n"
		, ...["tests 15", "pass 15", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-jvm-receivers.log\n`)
		, ...ownedJvmReceiverReports.map(path => `          test -s ${path}\n`)
		, "            build/owned-jvm-receiver-core/\n"
		, "            build/owned-jvm-receivers.log\n"
	]) {
		assert.equal(workflow.split(before).length, 2);
		assert.throws(() => assertOwnedJvmReceiverCi(workflow.replace(before, ""), manifest));
	}
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-jvm-receivers"] += " --test-name-pattern=core";
	assert.throws(() => assertOwnedJvmReceiverCi(workflow, changed));
});
