/**
 * Reject fabricated Ruby borrow observations and preserve prior source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeOwnedRubyBorrowCi, ownedRubyBorrowCiHistoricalBytes
	, ownedRubyBorrowCiPath, ownedRubyBorrowCiBaseline, ownedRubyBorrowCiPrevious
	, ownedRubyBorrowCiAddedPaths, ownedRubyBorrowCiChangedPaths
	, reverseOwnedRubyBorrowCiUpdate } from "./helpers/owned-ruby-borrow-ci-history.mjs";
import { assertOwnedRubyBorrowExecution, assertOwnedRubyBorrowCi } from "./helpers/owned-ruby-borrow-evidence.mjs";
import { ownedRubyBorrowPath, ownedRubyBorrowBaseline, ownedRubyBorrowPrevious
	, ownedRubyBorrowAddedPaths, ownedRubyBorrowChangedPaths
	, beforeOwnedRubyBorrow, reverseOwnedRubyBorrowUpdate } from "./helpers/owned-ruby-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedRubyBorrowPath, "utf8"));

test("Ruby borrow evidence authenticates complete source changes without rewriting predecessors", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-ruby-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedRubyBorrowBaseline);
	assert.deepEqual(record.previous, ownedRubyBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedRubyBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedRubyBorrowCiHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedRubyBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedRubyBorrowCi(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedRubyBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedRubyBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedRubyBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedRubyBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedRubyBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedRubyBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedRubyBorrowCi(path, await readFile(path, "utf8"));
	const prior = JSON.parse(beforeOwnedRubyBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedRubyBorrowCiHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	const module = "src/backends/ruby/owned-borrows.mjs";
	const files = JSON.parse(await readFile("config/cli-package.v1.json", "utf8")).files;
	assert.deepEqual(JSON.parse(await readFile("package.json", "utf8")).files, files);
	assert.ok(files.includes(module));
	assert.ok(JSON.parse(await readFile("nix/perl-engine-source-boundary.json", "utf8")).includedFiles.includes(module));
});

test("Ruby borrow profile repair authenticates the registration without changing runtime evidence", async () => {
	const record = JSON.parse(await readFile(ownedRubyBorrowCiPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-ruby-borrow-ci-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedRubyBorrowCiBaseline);
	assert.deepEqual(record.previous, ownedRubyBorrowCiPrevious); assert.equal(record.typeSupportPromotions, 0);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.equal(record.run.command, "node --test tests/test-profiles.test.mjs");
	assert.equal(record.run.exitCode, 0); assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 4, pass: 4, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp(`^# ${name} ${count}$`, "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedRubyBorrowCiAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedRubyBorrowCiChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		assert.equal(sha256(reverseOwnedRubyBorrowCiUpdate(await readFile(update.path, "utf8"), update)), update.previousSha256);
	}
	const path = "src/adoption/test-profiles.mjs", source = await readFile(path, "utf8");
	const prior = reverseOwnedRubyBorrowCiUpdate(source, record.updates.find(update => update.path === path));
	assert.equal(source, prior.replace('\t\t, "owned-ruby-transfer-evidence"', '\t\t, "owned-ruby-transfer-evidence"\n\t\t, "owned-ruby-borrow-evidence"'));
	assert.equal(classifyRepositoryTest("tests/owned-ruby-borrow-evidence.test.mjs"), "contract");
	const indexPath = "docs/type-surface.v1.json", current = await readFile(indexPath, "utf8");
	const oldIndex = JSON.parse(reverseOwnedRubyBorrowCiUpdate(current, record.updates.find(update => update.path === indexPath)));
	for(const evidence of oldIndex.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), oldIndex);
});

test("Ruby borrow profile repair rejects unknown changes and forged reversal spans", async () => {
	const record = JSON.parse(await readFile(ownedRubyBorrowCiPath, "utf8"));
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedRubyBorrowCi(update.path, unknown), unknown);
		assert.equal(beforeOwnedRubyBorrowCi(update.path, source, update.currentSha256), source);
		assert.throws(() => reverseOwnedRubyBorrowCiUpdate(unknown, update));
		assert.throws(() => reverseOwnedRubyBorrowCiUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedRubyBorrowCiUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Ruby borrow evidence requires real Lean and installed gems on both paths", async () => {
	await assertOwnedRubyBorrowExecution(await read());
});

test("Ruby borrow evidence rejects missing observations, forged lifetimes and false scope", async () => {
	const record = await read();
	for(const mutate of [
		...["docker", "independentRebuild", "otherConsumerProjections", "receiverAnchors", "callbackResultAnchors"].map(key => value => { value.scope[key] = true; })
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.scope.rawResourceViews = "independent"; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.borrowOnly.observations.pop(); }
		, value => { value.borrowOnly.observations[1].stdout = "not run"; }
		, value => { value.borrowOnly.observations[0].nativeSha256 = "0".repeat(64); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].observed.identities++; }
		, value => { value.runtime[1].observed.nativeAfter = 0; }
		, value => { value.runtime[1].rejectedMutations.pop(); }
		, value => { value.runtime[0].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].nativeSha256 = "0".repeat(64); }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[1].relocatedObservation.checks = 0; }
		, value => { value.packages[0].consumerSha256 = "0".repeat(64); }
		, value => { value.packages[1].input.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.packages[0].componentReceipt.resultAnchors.exports[0].parameter = 999; }
		, value => { value.packages[1].adapterReceipt.rubyValues.resultAnchors.expiration = "session-close"; }
		, value => { value.packages[0].manifest.ownedValues.resultAnchors.emptyValues = "discarded"; }
		, value => { value.packages[1].manifest.schemaVersion = 2; }
		, value => { value.packages[0].documentation.sha256 = "0".repeat(64); }
		, value => { value.packages[1].tamperRejected.pop(); }
		, value => { value.packages[1].incapableReadersRejected = 0; }
		, value => { value.packages[1].loader.liveIdentities = 1; }
		, value => { value.packages[0].loader.forkBeforeLock = false; }
		, value => { value.packages[1].adapterReceipt.gmp.binding = "global-symbols"; }
		, value => { value.packages[1].companions.rust = 0; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedRubyBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("Ruby borrow CI requires seven enabled tests and all runtime and package reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedRubyBorrowCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-ruby-borrows > build/owned-ruby-borrows.log 2>&1"
		, "          rg '^# pass 7$' build/owned-ruby-borrows.log"
		, "          rg '^# fail 0$' build/owned-ruby-borrows.log"
		, "          rg '^# skipped 0$' build/owned-ruby-borrows.log"
		, "          test -s build/owned-ruby-borrows/ordinary.json"
		, "          test -s build/owned-ruby-borrows/reviewed.json"
		, "          test -s build/owned-ruby-borrows/borrow-only.json"
		, "          test -s build/owned-ruby-borrow-packaging/ordinary.json"
		, "          test -s build/owned-ruby-borrow-packaging/reviewed.json"
		, "            build/owned-ruby-borrows/"
		, "            build/owned-ruby-borrow-packaging/"
		, "            build/owned-ruby-borrows.log"
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedRubyBorrowCi(workflow.replace(line + "\n", ""), manifest));
	}
	const key = "test:owned-ruby-borrows";
	assert.throws(() => assertOwnedRubyBorrowCi(workflow, { ...manifest, scripts: { ...manifest.scripts, [key]: manifest.scripts[key].replace("=1", "=0") } }));
});
