/**
 * Authenticate repaired close lifetimes and reject unexecuted race evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertManagedCloseExecution, assertManagedCloseCi } from "./helpers/managed-close-evidence.mjs";
import { managedClosePath, managedCloseBaseline, managedClosePrevious
	, managedCloseChangedPaths, managedCloseAddedPaths
	, beforeManagedClose, reverseManagedCloseUpdate } from "./helpers/managed-close-history.mjs";

const read = async () => JSON.parse(await readFile(managedClosePath, "utf8"));

test("managed close repair preserves exact complete predecessor source versions", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "managed-whole-close-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, managedCloseBaseline);
	assert.deepEqual(record.previous, managedClosePrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...managedCloseAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), managedCloseChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeManagedClose(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeManagedClose(update.path, prior), prior);
		assert.equal(beforeManagedClose(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeManagedClose(update.path, unknown), unknown);
		assert.throws(() => reverseManagedCloseUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseManagedCloseUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeManagedClose(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["managed-close-evidence", "managed-close-generated-history"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("managed close repair requires complete installed Python and Ruby execution", async () => {
	await assertManagedCloseExecution(await read());
	assertManagedCloseCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json")));
});

test("managed close repair rejects missing races, weakened cleanup and forged scope", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.receiverAnchors = true; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.python.scope.foreignCloseSnapshots = false; }
		, value => { value.ruby.scope.foreignCloseSnapshots = false; }
		, value => { value.python.run.exitCode = 1; }
		, value => { value.ruby.run.text += "unrecorded"; }
		, value => { value.python.run.text = value.python.run.text.replace("# skipped 0", "# skipped 1"); value.python.run.sha256 = sha256(value.python.run.text); }
		, value => { value.python.runtime.pop(); }
		, value => { value.ruby.runtime.pop(); }
		, value => { value.python.runtime[0].observations[0].foreignCloseSchedules.pop(); }
		, value => { value.ruby.runtime[1].observed.foreignCloseSchedules.pop(); }
		, value => { value.python.runtime[1].observations[2].checks--; }
		, value => { value.ruby.runtime[0].observed.identities++; }
		, value => { value.python.runtime[0].observations[0].rejectedMutations.pop(); }
		, value => { value.ruby.runtime[1].rejectedMutations.pop(); }
		, value => { value.python.runtime[0].runtimeSha256 = "0".repeat(64); }
		, value => { value.ruby.runtime[1].probeSha256 = "0".repeat(64); }
		, value => { value.python.typing.observations.pop(); }
		, value => { value.ruby.borrowOnly.observations.pop(); }
		, value => { value.python.packages.pop(); }
		, value => { value.ruby.packages[0].sourceFreeInstallation = false; }
		, value => { value.python.packages[1].observations[0].relocatedChecks = 0; }
		, value => { value.ruby.packages[1].relocatedObservation.checks = 0; }
		, value => { value.python.packages[0].adapterReceipt.pythonValues.runtimeSha256 = "0".repeat(64); }
		, value => { value.ruby.packages[0].manifest.ownedValues.runtimeSha256 = "0".repeat(64); }
		, value => { value.ruby.packages[1].documentation.stdout = "not run"; }
		, value => { value.python.packages[1].companions.rust = 0; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertManagedCloseExecution(changed), undefined, mutate.toString());
	}
});
