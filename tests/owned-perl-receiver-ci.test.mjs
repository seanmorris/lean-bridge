/**
 * Reject missing ABIs, skipped receiver suites and discarded installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedPhpWasmReceiver, ownedPhpWasmReceiverHistoricalBytes } from "./helpers/owned-php-wasm-receiver-history.mjs";
import { assertOwnedPerlReceiverCi, ownedPerlReceiverReports } from "./helpers/owned-perl-receiver-ci.mjs";
import { beforeOwnedReceiverCiRepair, ownedReceiverCiRepairPath, ownedReceiverCiRepairBaseline
	, ownedReceiverCiRepairPrevious, ownedReceiverCiRepairChangedPaths, ownedReceiverCiRepairAddedPaths
	, ownedReceiverCiRepairHistoricalBytes, reverseOwnedReceiverCiRepair } from "./helpers/owned-receiver-ci-repair-history.mjs";

test("Perl receiver CI requires four complete ABI runs and thirteen reports", async () => {
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedPerlReceiverCi(workflow, manifest);
	const [prefix, suffix] = workflow.split("  perl-receivers:\n");
	for(const before of [
		... ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"].map(abi => "          - " + abi + "\n")
		, "        run: sudo apt-get update && sudo apt-get install -y build-essential curl zstd ripgrep\n"
		, "          npm run test:owned-perl-receivers > build/owned-perl-receivers.log 2>&1\n"
		, ...["tests 16", "pass 16", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-perl-receivers.log\n`)
		, ...ownedPerlReceiverReports.map(path => `          test -s ${path}\n`)
		, "            build/owned-perl-receiver-core/\n"
		, "            build/owned-perl-receivers.log\n"
	]) {
		assert.equal(suffix.split(before).length, 2);
		assert.throws(() => assertOwnedPerlReceiverCi(prefix + "  perl-receivers:\n" + suffix.replace(before, ""), manifest), undefined, before);
	}
	for(const line of ["    if: false\n", "    continue-on-error: true\n"])
		assert.throws(() => assertOwnedPerlReceiverCi(prefix + "  perl-receivers:\n" + line + suffix, manifest));
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-perl-receivers"] += " --test-name-pattern=core";
	assert.throws(() => assertOwnedPerlReceiverCi(workflow, changed));
	assert.throws(() => assertOwnedPerlReceiverCi(prefix + "  perl-receivers:\n" + suffix.replace("zstd ripgrep", "zstd"), manifest));
});

test("receiver CI repair preserves frozen receipts and rejects unrelated source changes", async () => {
	const record = JSON.parse(await readFile(ownedReceiverCiRepairPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-receiver-ci-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedReceiverCiRepairBaseline);
	assert.deepEqual(record.previous, ownedReceiverCiRepairPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedReceiverCiRepairAddedPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedReceiverCiRepairChangedPaths);
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedPhpWasmReceiverHistoricalBytes(path, await readFile(path), digest)), digest, path);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedPhpWasmReceiver(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const prior = beforeOwnedReceiverCiRepair(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedReceiverCiRepair(update.path, prior), prior);
		assert.equal(beforeOwnedReceiverCiRepair(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedReceiverCiRepair(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedReceiverCiRepair(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrelated.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedReceiverCiRepair(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedReceiverCiRepairHistoricalBytes("unrelated.bin", binary), binary);
	const path = "docs/type-surface.v1.json", current = beforeOwnedPhpWasmReceiver(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedReceiverCiRepair(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedPhpWasmReceiverHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
});
