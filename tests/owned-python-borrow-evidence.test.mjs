/**
 * Reject fabricated Python borrow observations and preserve prior source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedRubyBorrow, ownedRubyBorrowHistoricalBytes } from "./helpers/owned-ruby-borrow-history.mjs";
import { assertOwnedPythonBorrowExecution, assertOwnedPythonBorrowCi } from "./helpers/owned-python-borrow-evidence.mjs";
import { ownedPythonBorrowPath, ownedPythonBorrowBaseline, ownedPythonBorrowPrevious
	, ownedPythonBorrowAddedPaths, ownedPythonBorrowChangedPaths
	, beforeOwnedPythonBorrow, reverseOwnedPythonBorrowUpdate } from "./helpers/owned-python-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPythonBorrowPath, "utf8"));

test("Python borrow evidence authenticates complete source changes without rewriting predecessors", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-python-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPythonBorrowBaseline);
	assert.deepEqual(record.previous, ownedPythonBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPythonBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedRubyBorrowHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPythonBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedRubyBorrow(update.path, await readFile(update.path, "utf8"));
		const prior = beforeOwnedPythonBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPythonBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedPythonBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedPythonBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPythonBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedPythonBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedRubyBorrow(path, await readFile(path, "utf8"));
	const prior = JSON.parse(beforeOwnedPythonBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedRubyBorrowHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior);
	const module = "src/backends/python/owned-borrows.mjs";
	const files = JSON.parse(await readFile("config/cli-package.v1.json", "utf8")).files;
	assert.deepEqual(JSON.parse(await readFile("package.json", "utf8")).files, files);
	assert.ok(files.includes(module));
	assert.ok(JSON.parse(await readFile("nix/perl-engine-source-boundary.json", "utf8")).includedFiles.includes(module));
});

test("Python borrow evidence requires real Lean, strict typing and installed wheels on both paths", async () => {
	await assertOwnedPythonBorrowExecution(await read());
});

test("Python borrow evidence rejects missing observations, forged lifetimes and false scope", async () => {
	const record = await read();
	for(const mutate of [
		...["docker", "independentRebuild", "otherConsumerProjections", "receiverAnchors", "callbackResultAnchors"].map(key => value => { value.scope[key] = true; })
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.typing.observations.pop(); }
		, value => { value.typing.observations[0].rejected.pop(); }
		, value => { value.typing.observations[1].borrowOnlyCompiled = false; }
		, value => { value.typing.stubSha256 = "0".repeat(64); }
		, value => { value.typing.positiveSha256 = "0".repeat(64); }
		, value => { value.typing.invalidSha256 = "0".repeat(64); }
		, value => { value.borrowOnly.observations.pop(); }
		, value => { value.borrowOnly.observations[0].interpreters.pop(); }
		, value => { value.borrowOnly.observations[1].interpreters[0].stdout = "not run"; }
		, value => { value.borrowOnly.observations[0].nativeSha256 = "0".repeat(64); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].observations[0].identities++; }
		, value => { value.runtime[0].observations[0].retainedLifetimeFailures.pop(); }
		, value => { value.runtime[1].observations[1].nativeAfter = 0; }
		, value => { value.runtime[0].observations.pop(); }
		, value => { value.runtime[1].observations[0].rejectedMutations.pop(); }
		, value => { value.runtime[0].observations[0].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].nativeSha256 = "0".repeat(64); }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[1].observations[0].relocatedChecks = 0; }
		, value => { value.packages[0].consumerSha256 = "0".repeat(64); }
		, value => { value.packages[1].input.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.packages[0].componentReceipt.resultAnchors.exports[0].parameter = 999; }
		, value => { value.packages[1].adapterReceipt.pythonValues.resultAnchors.expiration = "session-close"; }
		, value => { value.packages[0].observations[0].manifest.ownedValues.resultAnchors.emptyValues = "discarded"; }
		, value => { value.packages[1].observations[1].manifest.schemaVersion = 3; }
		, value => { value.packages[0].documentationSha256 = "0".repeat(64); }
		, value => { value.packages[1].tamperRejected.pop(); }
		, value => { value.packages[0].observations[0].installation.resolvedOffline = false; }
		, value => { value.packages[1].observations[0].installation.dependency.sha256 = "0".repeat(64); }
		, value => { value.packages[1].observations[2].loader.liveIdentities = 1; }
		, value => { value.packages[0].observations[2].loader.conflictingRuntimeRejected = false; }
		, value => { value.packages[1].companions.rust = 0; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPythonBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("Python borrow CI requires eight enabled tests and all runtime and package reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedPythonBorrowCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-python-borrows > build/owned-python-borrows.log 2>&1"
		, "          rg '^# pass 8$' build/owned-python-borrows.log"
		, "          rg '^# fail 0$' build/owned-python-borrows.log"
		, "          rg '^# skipped 0$' build/owned-python-borrows.log"
		, "          test -s build/owned-python-borrows/ordinary.json"
		, "          test -s build/owned-python-borrows/reviewed.json"
		, "          test -s build/owned-python-borrows/typing.json"
		, "          test -s build/owned-python-borrows/borrow-only.json"
		, "          test -s build/owned-python-borrow-packaging/ordinary.json"
		, "          test -s build/owned-python-borrow-packaging/reviewed.json"
		, "            build/owned-python-borrows/"
		, "            build/owned-python-borrow-packaging/"
		, "            build/owned-python-borrows.log"
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedPythonBorrowCi(workflow.replace(line + "\n", ""), manifest));
	}
	const key = "test:owned-python-borrows";
	assert.throws(() => assertOwnedPythonBorrowCi(workflow, { ...manifest, scripts: { ...manifest.scripts, [key]: manifest.scripts[key].replace("=1", "=0") } }));
});
