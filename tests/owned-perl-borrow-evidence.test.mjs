/**
 * Authenticate Perl borrowed-result execution and exact predecessor source text.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeOwnedPhpBorrow, ownedPhpBorrowHistoricalBytes } from "./helpers/owned-php-borrow-history.mjs";
import { assertOwnedPerlBorrowExecution, assertOwnedPerlBorrowCi } from "./helpers/owned-perl-borrow-evidence.mjs";
import { ownedPerlBorrowPath, ownedPerlBorrowBaseline, ownedPerlBorrowPrevious
	, ownedPerlBorrowChangedPaths, ownedPerlBorrowAddedPaths
	, beforeOwnedPerlBorrow, reverseOwnedPerlBorrowUpdate } from "./helpers/owned-perl-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPerlBorrowPath, "utf8"));

test("Perl borrowed-result evidence preserves complete authenticated predecessor versions", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPerlBorrowBaseline);
	assert.deepEqual(record.previous, ownedPerlBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPerlBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedPhpBorrowHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPerlBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedPhpBorrow(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const prior = beforeOwnedPerlBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPerlBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedPerlBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedPerlBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPerlBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedPerlBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedPhpBorrow(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedPerlBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedPhpBorrowHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	assert.equal(classifyRepositoryTest("tests/owned-perl-borrow-evidence.test.mjs"), "contract");
	for(const name of ["owned-perl-borrows", "owned-perl-borrow-packaging", "owned-perl-borrow-documentation"])
		assert.equal(classifyRepositoryTest(`tests/${name}.test.mjs`), "contract");
});

test("Perl borrowed-result evidence requires installed packages and both compiler paths", async () => {
	await assertOwnedPerlBorrowExecution(await read());
	assertOwnedPerlBorrowCi(await readFile(".github/workflows/perl-consumer.yml", "utf8"), JSON.parse(await readFile("package.json")));
});

test("Perl borrowed-result evidence rejects missing execution and altered lifetime claims", async () => {
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
		, value => { value.runtime[0].xsSha256 = "0".repeat(64); }
		, value => { value.runtime[0].observations.pop(); }
		, value => { value.runtime[0].observations[0].observed.identities++; }
		, value => { value.runtime[0].observations[0].observed.heldErrors = 0; }
		, value => { value.runtime[0].observations[0].observed.faults.native.after = 0; }
		, value => { value.runtime[1].observations[1].rejectedMutations.pop(); }
		, value => { value.runtime[1].observations[1].rejectedMutations[0].compiled = false; }
		, value => { value.borrowOnly.observations.pop(); }
		, value => { value.borrowOnly.observations[0].xsSha256 = "0".repeat(64); }
		, value => { value.borrowOnly.observations[1].stdout = "not run"; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].handoffRemovedBeforeExecution = false; }
		, value => { value.packages[0].observations.pop(); }
		, value => { value.packages[0].observations[0].observed.checks = 0; }
		, value => { value.packages[1].observations[1].runtimeOnlyRuns = 0; }
		, value => { value.packages[1].observations[1].assets.observations.pop(); }
		, value => { value.packages[1].owned.resultAnchors.emptyValues = "unowned"; }
		, value => { value.packages[1].componentReceipt.resultAnchors.exports.pop(); }
		, value => { value.packages[1].files["Component.xs"] = "0".repeat(64); }
		, value => { value.packages[0].tamperRejections.pop(); }
		, value => { value.documentation.observations.pop(); }
		, value => { value.documentation.observations[0].stdout = "not run"; }
		, value => { value.documentation.sourceHashes.example = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPerlBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("Perl borrowed-result CI cannot skip execution or omit required reports", async () => {
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json"));
	assertOwnedPerlBorrowCi(workflow, manifest);
	for(const part of ["          npm run test:owned-perl-borrows\n"
		, "          test -s build/owned-perl-borrows/ordinary.json\n"
		, "          test -s build/owned-perl-borrows/borrow-only.json\n"
		, "          test -s build/owned-perl-borrow-packaging/documentation.json\n"
		, "            build/owned-perl-borrows/\n"])
		assert.throws(() => assertOwnedPerlBorrowCi(workflow.replace(part, ""), manifest));
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-perl-borrows"] = "echo skipped";
	assert.throws(() => assertOwnedPerlBorrowCi(workflow, changed));
});
