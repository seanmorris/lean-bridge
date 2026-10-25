/**
	* Authenticate the Core repair without rewriting original receipt bytes.
	*
	* @file
	*/
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeCoreAuthorPublicationRepairSource
	, coreAuthorPublicationRepairAddedPaths
	, coreAuthorPublicationRepairChangedPaths
	, coreAuthorPublicationRepairCommits
	, coreAuthorPublicationRepairImplementationPaths
	, coreAuthorPublicationRepairHistoryPath
	, coreAuthorPublicationRepairImplementation
	, coreAuthorPublicationRepairIntegrationBase
	, coreAuthorPublicationRepairIntegrationPaths
	, coreAuthorPublicationRepairPredecessor
	, reverseCoreAuthorPublicationRepairUpdate
} from "./core-author-publication-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(coreAuthorPublicationRepairHistoryPath, "utf8"));
const evidenceDirectory = "docs/evidence/core-author-publication-repair-20261025";
const committed = path => git(["show", coreAuthorPublicationRepairImplementation + ":" + path]);
const acceptance = () => JSON.parse(committed(evidenceDirectory + "/acceptance.json"));

test("Core author-publication repair authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-author-publication-repair-source-v1");
	assert.equal(record.predecessorCommit, coreAuthorPublicationRepairPredecessor);
	assert.equal(record.implementationCommit, coreAuthorPublicationRepairImplementation);
	assert.equal(record.integrationBaseCommit, coreAuthorPublicationRepairIntegrationBase);
	assert.deepEqual(record.implementationCommits, coreAuthorPublicationRepairCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreAuthorPublicationRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, coreAuthorPublicationRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreAuthorPublicationRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, coreAuthorPublicationRepairPredecessor + ".." + coreAuthorPublicationRepairImplementation]).trim().split("\n")
	, coreAuthorPublicationRepairCommits);
	for(const [index, revision] of coreAuthorPublicationRepairCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? coreAuthorPublicationRepairPredecessor : coreAuthorPublicationRepairCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, coreAuthorPublicationRepairPredecessor
		, coreAuthorPublicationRepairImplementation]).trim().split("\n")
	, [...coreAuthorPublicationRepairImplementationPaths].sort());
	const updates = [...record.updates, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCoreAuthorPublicationRepairSource);
		const prior = record.integrationUpdates.includes(update)
			? coreAuthorPublicationRepairIntegrationBase : coreAuthorPublicationRepairPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseCoreAuthorPublicationRepairUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Core author-publication repair preserves runtime, published documentation and inventory", () => {
	for(const path of ["src", "site", ".github", "docs/type-surface.v1.json"
		, "docs/lean", "docs/reference", "docs/php.md", "docs/publish/php.md"])
		assert.equal(git(["rev-parse", coreAuthorPublicationRepairPredecessor + ":" + path])
			, git(["rev-parse", coreAuthorPublicationRepairImplementation + ":" + path]), path);
	const receipt = acceptance();
	assert.equal(receipt.inventory.unchanged, true);
	assert.equal(receipt.inventory.refreshedPins, 0);
	assert.equal(receipt.inventory.bytes, 102577221);
	assert.equal(receipt.inventory.sha256, "66d8a954207550372f8b41fe59aa06f497bf829b174293f5e714ecc806da8a63");
	assert.deepEqual(receipt.sourcePins.map(pin => pin.path), coreAuthorPublicationRepairChangedPaths);
	for(const pin of receipt.sourcePins)
	{
		assert.equal(pin.count, 0);
		assert.equal(sha256(git(["show", coreAuthorPublicationRepairPredecessor + ":" + pin.path])), pin.previous);
		assert.equal(sha256(committed(pin.path)), pin.current);
	}
	assert.deepEqual(receipt.pending, [
		"full-final-head-Core"
		, "complete-producer-input-reconciliation"
		, "recurring-default-branch-activation"
	]);
});

test("Core author-publication repair retains both original failures and nine passing checks", () => {
	const receipt = acceptance();
	const { tests, originalFailures, diagnostics } = receipt.validation;
	for(const file of [...tests.map(item => item.file), originalFailures, diagnostics])
	{
		const bytes = committed(file.path);
		assert.equal(Buffer.byteLength(bytes), file.bytes);
		assert.equal(sha256(bytes), file.sha256);
	}
	assert.deepEqual(tests.map(item => item.count), [3, 3, 3]);
	for(const { file, count } of tests)
	{
		const tap = committed(file.path);
		assert.match(tap, /^TAP version 13\n/u);
		for(const line of ["1.." + count, "# tests " + count, "# pass " + count
			, "# fail 0", "# skipped 0", "# cancelled 0"])
			assert.ok(tap.split("\n").includes(line), file.path + ": " + line);
		assert.doesNotMatch(tap, /^not ok |# SKIP|# TODO/mu);
	}
	const original = committed(originalFailures.path);
	assert.match(original, /^not ok 1 - generated entry guidance agrees/mu);
	assert.match(original, /^not ok 2 - the checked-record author table agrees/mu);
	assert.match(original, /^# fail 2$/mu);
	assert.match(original, /^# pass 0$/mu);
	const diagnosis = JSON.parse(committed(diagnostics.path));
	assert.equal(diagnosis.remote.run, 40160209518);
	assert.deepEqual(diagnosis.remote.logs.map(item => item.job), [121069998011, 121069998314]);
	for(const log of diagnosis.remote.logs)
		assert.ok(log.selectedLines.some(line => /runner has received a shutdown signal/u.test(line.text)));
	assert.equal(diagnosis.local[0].exitCode, 1);
	assert.equal(diagnosis.local[0].fail, 2);
	assert.equal(receipt.validation.lint.exitCode, 0);
	assert.equal(receipt.validation.typecheck.exitCode, 0);
});

test("Core author-publication repair rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCoreAuthorPublicationRepairSource);
	assert.equal(beforeCoreAuthorPublicationRepairSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeCoreAuthorPublicationRepairSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseCoreAuthorPublicationRepairUpdate(current, forged));
	assert.equal(beforeCoreAuthorPublicationRepairSource(
		"unrelated.mjs", current), current);
});

test("Core author-publication repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-author-publication-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-author-publication-repair-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
