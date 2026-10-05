/**
 * Authenticate PHP borrowed-result execution and exact predecessor source text.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeOwnedPhpWasmBorrow, ownedPhpWasmBorrowHistoricalBytes } from "./helpers/owned-php-wasm-borrow-history.mjs";
import { assertOwnedPhpBorrowExecution, assertOwnedPhpBorrowCi } from "./helpers/owned-php-borrow-evidence.mjs";
import { ownedPhpBorrowPath, ownedPhpBorrowBaseline, ownedPhpBorrowPrevious
	, ownedPhpBorrowChangedPaths, ownedPhpBorrowAddedPaths
	, beforeOwnedPhpBorrow, reverseOwnedPhpBorrowUpdate } from "./helpers/owned-php-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPhpBorrowPath, "utf8"));

test("PHP borrowed-result evidence preserves complete authenticated predecessor versions", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPhpBorrowBaseline);
	assert.deepEqual(record.previous, ownedPhpBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPhpBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedPhpWasmBorrowHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedPhpWasmBorrow(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const prior = beforeOwnedPhpBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPhpBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedPhpBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedPhpBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPhpBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedPhpBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedPhpWasmBorrow(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedPhpBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedPhpWasmBorrowHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["owned-php-borrow-evidence", "owned-php-borrows"
		, "owned-php-borrow-packaging", "owned-php-borrow-documentation"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("PHP borrowed-result evidence requires installed packages and both compiler paths", async () => {
	await assertOwnedPhpBorrowExecution(await read());
	assertOwnedPhpBorrowCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json")));
});

test("PHP borrowed-result evidence rejects missing execution and altered lifetime claims", async () => {
	const record = await read();
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.receiverAnchors = true; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].nativeSourceSha256 = "0".repeat(64); }
		, value => { value.runtime[0].publicHeaderSha256 = "0".repeat(64); }
		, value => { value.runtime[0].observed.identities++; }
		, value => { value.runtime[0].observed.heldErrors = 0; }
		, value => { value.runtime[0].observed.faults.move.native.after = 0; }
		, value => { value.runtime[1].mutants.pop(); }
		, value => { value.runtime[1].mutants[0].parsed = false; }
		, value => { value.runtime[1].mutants[0].semanticRejection = false; }
		, value => { value.borrowOnly.observations.pop(); }
		, value => { value.borrowOnly.observations[0].nativeSourceSha256 = "0".repeat(64); }
		, value => { value.borrowOnly.observations[1].observed.live++; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].handoffRemoved = false; }
		, value => { value.packages[0].observations.pop(); }
		, value => { value.packages[0].observations[0].observed.checks = 0; }
		, value => { value.packages[1].loader.automaticShutdown = false; }
		, value => { value.packages[1].componentReceipt.resultAnchors.exports.pop(); }
		, value => { value.packages[1].adapterReceipt.phpValues.resultAnchors.emptyValues = "unowned"; }
		, value => { value.packages[1].installation.receipt.files["src/Api.php"].sha256 = "0".repeat(64); }
		, value => { value.packages[0].tamperRejected.pop(); }
		, value => { value.documentation.handoffRemoved = false; }
		, value => { value.documentation.observed.stdout = "not run"; }
		, value => { value.documentation.sourceHashes.example = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPhpBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("PHP borrowed-result CI cannot skip execution or omit required reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json"));
	assertOwnedPhpBorrowCi(workflow, manifest);
	for(const part of ["          npm run test:owned-php-borrows\n"
		, "          test -s build/owned-php-borrows/ordinary.json\n"
		, "          test -s build/owned-php-borrows/reviewed.json\n"
		, "          test -s build/owned-php-borrows/borrow-only.json\n"
		, "          test -s build/owned-php-borrow-packaging/documentation.json\n"
		, "            build/owned-php-borrows/\n"])
		assert.throws(() => assertOwnedPhpBorrowCi(workflow.replace(part, ""), manifest));
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-php-borrows"] = "echo skipped";
	assert.throws(() => assertOwnedPhpBorrowCi(workflow, changed));
});
