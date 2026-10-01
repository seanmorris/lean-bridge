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
import { ownedJvmReceiverPath, ownedJvmReceiverBaseline, ownedJvmReceiverPrevious
	, ownedJvmReceiverChangedPaths, ownedJvmReceiverAddedPaths
	, beforeOwnedJvmReceiver, reverseOwnedJvmReceiverUpdate } from "./helpers/owned-jvm-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJvmReceiverPath, "utf8"));

test("JVM receiver evidence binds exact sources and preserves historical support cells", async () => {
	const record = await read();
	assert.equal(record.kind, "owned-jvm-receivers"); assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, ownedJvmReceiverBaseline); assert.deepEqual(record.previous, ownedJvmReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedJvmReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(item => item.path), ownedJvmReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]); assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedJvmReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256); assert.equal(beforeOwnedJvmReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedJvmReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedJvmReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJvmReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unrelated.mjs" }])
			assert.throws(() => reverseOwnedJvmReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedJvmReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
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
