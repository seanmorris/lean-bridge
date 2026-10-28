/**
 * Authenticate the Core shard-five and shard-eight repair range.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCoreShardFiveEightRepairSource
	, coreShardFiveEightRepairAddedPaths
	, coreShardFiveEightRepairCommits
	, coreShardFiveEightRepairHistoryPath
	, coreShardFiveEightRepairImplementation
	, coreShardFiveEightRepairImplementationPaths
	, coreShardFiveEightRepairIntegrationPaths
	, coreShardFiveEightRepairPredecessor
	, reverseCoreShardFiveEightRepairUpdate
} from "./core-shard-five-eight-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreShardFiveEightRepairHistoryPath, "utf8"
));

test("Core shard-five/eight repair records its exact source range", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "implementationCommit", "integrationUpdates", "milestone"
		, "predecessorCommit", "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-shard-five-eight-repair-source-v1");
	assert.equal(record.predecessorCommit, coreShardFiveEightRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreShardFiveEightRepairImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreShardFiveEightRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreShardFiveEightRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreShardFiveEightRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${coreShardFiveEightRepairPredecessor}..${coreShardFiveEightRepairImplementation}`]).trim().split("\n")
		, coreShardFiveEightRepairCommits);
});

test("Core shard-five/eight repair reverses every source transition", async () => {
	const record = await readRecord();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreShardFiveEightRepairSource);
		const base = record.integrationUpdates.includes(update)
			? coreShardFiveEightRepairImplementation
			: coreShardFiveEightRepairPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreShardFiveEightRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core shard-five/eight repair names every bounded repair", () => {
	const source = path => git(["show"
		, `${coreShardFiveEightRepairImplementation}:${path}`]);
	for(const path of [
		"tests/owned-perl-borrow-evidence.test.mjs"
		, "tests/owned-rust-transfer-evidence.test.mjs"
		, "tests/php-nix-boundary-repair-evidence.test.mjs"
		, "tests/structured-docs-ci-evidence.test.mjs"
	]) assert.match(source(path), /update\.previousSha256/u, path);
	assert.match(source("tests/helpers/native-specialization-closure.mjs")
		, /core-evidence-prefix: generic-record-array-hosts-/u);
	for(const path of ["tests/perl-scalar-promotion.test.mjs"
		, "tests/type-surface.test.mjs"])
		assert.match(source(path), /core-evidence-prefix: reviewed-fin-hosts-/u);
	assert.match(source("tests/helpers/owned-ruby-evidence.mjs")
		, /moduleAtProducerWithSourceReads/u);
	assert.match(source("tests/type-surface.test.mjs")
		, /hosted-signature-specializations-installed/u);
});

test("Core shard-five/eight repair rejects forged transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${coreShardFiveEightRepairImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreShardFiveEightRepairUpdate(
			current, forged));
	const unknown = `${current}unknown\n`;
	assert.equal(beforeCoreShardFiveEightRepairSource(update.path, unknown)
		, unknown);
});

test("Core shard-five/eight repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-shard-five-eight-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-shard-five-eight-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
