/**
 * Reject incomplete execution, forged contracts and unrecorded Rust borrow edits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedRustBorrowExecution, assertOwnedRustBorrowCi } from "./helpers/owned-rust-borrow-evidence.mjs";
import { ownedRustBorrowPath, ownedRustBorrowBaseline, ownedRustBorrowPrevious
	, ownedRustBorrowAddedPaths, ownedRustBorrowChangedPaths, beforeOwnedRustBorrow
	, reverseOwnedRustBorrowUpdate } from "./helpers/owned-rust-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedRustBorrowPath, "utf8"));

test("Rust borrow evidence authenticates exact source transitions without rewriting predecessors", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-rust-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedRustBorrowBaseline);
	assert.deepEqual(record.previous, ownedRustBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedRustBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedRustBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedRustBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedRustBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedRustBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedRustBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedRustBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedRustBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedRustBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
	const files = JSON.parse(await readFile("config/cli-package.v1.json", "utf8")).files;
	assert.deepEqual(JSON.parse(await readFile("package.json", "utf8")).files, files);
	const included = JSON.parse(await readFile("nix/perl-engine-source-boundary.json", "utf8")).includedFiles;
	for(const language of ["cpp", "rust"])
	{
		const module = `src/backends/${language}/owned-borrows.mjs`;
		assert.ok(files.includes(module)); assert.ok(included.includes(module));
	}
});

test("Rust borrow evidence requires compiled and relocated installed packages for both source paths", async () => {
	await assertOwnedRustBorrowExecution(await read());
});

test("Rust borrow evidence rejects missing observations, altered lifetime contracts and false scope", async () => {
	const record = await read();
	for(const mutate of [
		...["docker", "independentRebuild", "otherConsumerProjections", "receiverAnchors", "callbackResultAnchors"].map(key => value => { value.scope[key] = true; })
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.runs.runtime.exitCode = 1; }
		, value => { value.runs.installed.text += "unknown"; }
		, value => { value.runs.runtime.text = value.runs.runtime.text.replace("# skipped 0", "# skipped 1"); value.runs.runtime.sha256 = sha256(value.runs.runtime.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].result.identities++; }
		, value => { value.runtime[1].result.panicFaults = 0; }
		, value => { value.runtime[0].borrowOnlyCompiled = false; }
		, value => { value.runtime[1].rejectedMutations.pop(); }
		, value => { value.runtime[0].rejected.pop(); }
		, value => { value.runtime[0].nativeSha256 = "0".repeat(64); }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceFreeInstallation = false; }
		, value => { value.packages[1].relocatedChecks = 0; }
		, value => { value.packages[0].consumerSha256 = "0".repeat(64); }
		, value => { value.packages[1].input.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.packages[0].componentReceipt.resultAnchors.exports[0].parameter = 999; }
		, value => { value.packages[1].adapterReceipt.rustValues.resultAnchors.expiration = "session-close"; }
		, value => { value.packages[0].compiledReceipt.ownedValues.resultAnchors.emptyValues = "discarded"; }
		, value => { value.packages[0].compiledReceipt.schemaVersion = 3; }
		, value => { value.packages[1].manifest.schemaVersion = 3; }
		, value => { value.packages[0].manifest.ownedValues.resultAnchors.resourceEquality = "pointer"; }
		, value => { value.packages[0].documentation.stdout = "0\n"; }
		, value => { value.packages[1].forgedAnchorContractsRejected.pop(); }
		, value => { value.packages[0].dependencies.lockSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedRustBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("Rust borrow CI requires six enabled tests and retains both installed source paths", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedRustBorrowCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-rust-borrows > build/owned-rust-borrows.log 2>&1"
		, "          rg '^# pass 6$' build/owned-rust-borrows.log"
		, "          rg '^# fail 0$' build/owned-rust-borrows.log"
		, "          rg '^# skipped 0$' build/owned-rust-borrows.log"
		, "          test -s build/owned-rust-borrows/ordinary.json"
		, "          test -s build/owned-rust-borrows/reviewed.json"
		, "          test -s build/owned-rust-borrow-packaging/ordinary.json"
		, "          test -s build/owned-rust-borrow-packaging/reviewed.json"
		, "            build/owned-rust-borrows/"
		, "            build/owned-rust-borrow-packaging/"
		, "            build/owned-rust-borrows.log"
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedRustBorrowCi(workflow.replace(line + "\n", ""), manifest));
	}
	const key = "test:owned-rust-borrows";
	assert.throws(() => assertOwnedRustBorrowCi(workflow, { ...manifest, scripts: { ...manifest.scripts, [key]: manifest.scripts[key].replace("=1", "=0") } }));
});
