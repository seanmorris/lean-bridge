/**
 * Authenticate installed Perl input transfers and preserve frozen predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedPerlTransferExecution, assertOwnedPerlTransferCi } from "./helpers/owned-perl-transfer-evidence.mjs";
import { beforeOwnedPerlTransfer, ownedPerlTransferAddedPaths, ownedPerlTransferBaseline
	, ownedPerlTransferChangedPaths, ownedPerlTransferHistoricalBytes, ownedPerlTransferPath
	, ownedPerlTransferPrevious, ownedPerlTransferRegisteredSources, reverseOwnedPerlTransferUpdate } from "./helpers/owned-perl-transfer-history.mjs";
import { beforeOwnedTransferBatchInitialization, historicalOwnedTransferPackage } from "./helpers/owned-transfer-generated-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPerlTransferPath, "utf8"));

test("Perl transfers bind current sources without promoting unrelated type cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPerlTransferBaseline);
	assert.deepEqual(record.previous, ownedPerlTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	const sourcePaths = [
		...Object.keys(previous.sources)
		, ...Object.keys(ownedPerlTransferRegisteredSources)
		, ...ownedPerlTransferAddedPaths
	];
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set(sourcePaths)].sort());
	for(const path of Object.keys(ownedPerlTransferRegisteredSources))
	{
		assert.ok(ownedPerlTransferChangedPaths.includes(path));
		assert.equal(previous.sources[path], undefined);
	}
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPerlTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path] ?? ownedPerlTransferRegisteredSources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const current = await readFile(update.path, "utf8"), prior = beforeOwnedPerlTransfer(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPerlTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedPerlTransfer(update.path, current, update.currentSha256), current);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedPerlTransfer("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
});

test("Perl transfer history rejects unrelated edits and invalid reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedPerlTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPerlTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedPerlTransferUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedPerlTransferHistoricalBytes("unrelated.bin", binary), binary);
});

test("transfer batch initialization history requires an exact whole-artifact match", () => {
	const current = "  lb_owned_batch *batches[2] = {0}; size_t batch_count = 0;\n";
	const prior = "  lb_owned_batch *batches[2]; size_t batch_count = 0;\n";
	assert.equal(beforeOwnedTransferBatchInitialization(current, sha256(prior)), prior);
	assert.equal(beforeOwnedTransferBatchInitialization(current, sha256(current)), current);
	assert.equal(beforeOwnedTransferBatchInitialization(current + "changed", sha256(prior)), current + "changed");
	assert.equal(beforeOwnedTransferBatchInitialization(current, "0".repeat(64)), current);
	const generated = { source: current, files: { "src/adapter.c": current, "include/adapter.h": "unchanged" } };
	assert.deepEqual(historicalOwnedTransferPackage(generated, sha256(prior)), {
		source: prior
		, files: { "src/adapter.c": prior, "include/adapter.h": "unchanged" }
	});
	assert.equal(generated.source, current);
	assert.equal(historicalOwnedTransferPackage(generated, "0".repeat(64)), generated);
});

test("Perl transfer receipts require both compiler paths, installed CPAN and enabled CI", async () => {
	await assertOwnedPerlTransferExecution(await read());
	assertOwnedPerlTransferCi(await readFile(".github/workflows/perl-consumer.yml", "utf8"));
	const { scripts } = JSON.parse(await readFile("package.json", "utf8"));
	assert.equal(scripts["test:owned-perl-transfers"], "LEAN_BRIDGE_OWNED_PERL_TRANSFER_TEST=1 LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-perl-transfers.test.mjs tests/owned-perl-transfer-packaging.test.mjs tests/owned-perl-documentation.test.mjs");
});

test("Perl transfer evidence rejects forged handoffs, installs, docs and wider support", async () => {
	const original = await read();
	for(const mutate of [
		...["otherConsumerBindings", "anchoredBorrowedResults", "docker"].map(key => record => { record.scope[key] = true; })
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 9", "# pass 8"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.runtime[0].compiledLean = false; }
		, record => { record.runtime[0].observations.pop(); }
		, record => { record.runtime[1].observations[1].observed.single.allocator.before = 0; }
		, record => { record.runtime[0].observations[0].observed.multiple.native.after = 0; }
		, record => { record.runtime[1].observations[2].observed.identities = 1; }
		, record => { record.runtime[0].observations[0].observed.heldErrors = 0; }
		, record => { record.runtime[1].observations[3].observed.threaded = 1; }
		, record => { record.runtime[0].declarationsSha256 = "0".repeat(64); }
		, record => { record.consumers[0].producerRemoved = false; }
		, record => { record.consumers[1].observations[1].observed.checks = 0; }
		, record => { record.consumers[0].observations[0].runtimeOnlyRuns = 1; }
		, record => { record.consumers[1].handoffRemovedBeforeExecution = false; }
		, record => { record.consumers[0].observations[0].assets.observations.pop(); }
		, record => { record.consumers[1].observations[1].assets.observations[0].brokerIdentities = 1; }
		, record => { record.consumers[0].observations[0].observed.exports.pop(); }
		, record => { record.consumers[1].owned.inputTransfers.aliases = "independent"; }
		, record => { record.consumers[0].componentReceipt.inputTransfers.consumption = "after-lean-call"; }
		, record => { record.consumers[1].manifest.ownedValues.schemaVersion = 1; }
		, record => { record.consumers[0].files["Component.xs"] = "0".repeat(64); }
		, record => { record.consumers[1].tamperRejections.pop(); }
		, record => { record.consumers[0].packages.packages[0].abiVariants.pop(); }
		, record => { record.documentation.transferredInputs = false; }
		, record => { record.documentation.observations.pop(); }
		, record => { record.documentation.observations[0].stdout = "42\n"; }
		, record => { record.documentation.sourceHashes.config = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedPerlTransferExecution(changed), mutate.toString());
	}
});

test("Perl transfer CI rejects disabled gates and missing reports", async () => {
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	assertOwnedPerlTransferCi(workflow);
	for(const text of ["          npm run test:owned-perl-transfers\n"
		, "            build/owned-perl-transfer-packaging/\n"
		, "          test -s build/owned-perl-transfers/reviewed.json\n"
		, "          test -s build/owned-perl-transfer-packaging/documentation.json\n"])
		assert.throws(() => assertOwnedPerlTransferCi(workflow.replace(text, "")));
	const step = "      - name: Verify owned Perl values and installed CPAN archives\n";
	for(const weakened of ["        if: false\n", "        continue-on-error: true\n"])
		assert.throws(() => assertOwnedPerlTransferCi(workflow.replace(step, step + weakened)));
});
