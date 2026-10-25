/**
 * Authenticate independent publication baselines without changing accepted support.
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
	beforeOwnedPublicationCoexistenceSource
	, ownedPublicationCoexistenceAddedPaths
	, ownedPublicationCoexistenceChangedPaths
	, ownedPublicationCoexistenceImplementationPaths
	, ownedPublicationCoexistenceCommits
	, ownedPublicationCoexistenceIntegrationBase
	, ownedPublicationCoexistenceHistoryPath
	, ownedPublicationCoexistenceImplementation
	, ownedPublicationCoexistenceIntegrationPaths
	, ownedPublicationCoexistencePredecessor
	, reverseOwnedPublicationCoexistenceUpdate
} from "./owned-publication-coexistence-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedPublicationCoexistenceHistoryPath));
const predecessor = ownedPublicationCoexistencePredecessor;
const implementation = ownedPublicationCoexistenceImplementation;

test("Owned publication coexistence records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-publication-coexistence-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, ownedPublicationCoexistenceIntegrationBase);
	assert.deepEqual(record.implementationCommits, ownedPublicationCoexistenceCommits);
	for(const [index, commit] of ownedPublicationCoexistenceCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", commit]).trim()
			, index === 0 ? predecessor : ownedPublicationCoexistenceCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedPublicationCoexistenceImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedPublicationCoexistenceChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedPublicationCoexistenceIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedPublicationCoexistenceAddedPaths);
});

test("Owned publication coexistence reverses all three source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 3);
	const updates = [...record.updates, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? ownedPublicationCoexistenceIntegrationBase : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedPublicationCoexistenceUpdate(current, update), original);
		assert.equal(beforeOwnedPublicationCoexistenceSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned publication coexistence preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"
		, "docs/type-surface.v1.json"
		, "tests/fixtures/onboarding/owned-checked-records"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned publication coexistence refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedPublicationCoexistenceUpdate(current, forged));
	assert.equal(beforeOwnedPublicationCoexistenceSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedPublicationCoexistenceSource("unrelated.mjs", current), current);
});

test("Owned publication coexistence writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-publication-coexistence-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-publication-coexistence-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned publication coexistence binds the reproduced failure and current validation", async () => {
	const path = "docs/evidence/owned-publication-coexistence-20261025.json";
	const addition = (await read()).additions.find(item => item.path === path);
	const value = JSON.parse(await sourceAtFinHistoryMilestone(path, addition.currentSha256));
	assert.equal(value.kind, "owned-publication-coexistence-source-v1");
	assert.equal(value.sourceBaseCommit, predecessor);
	assert.equal(value.implementationCommit, implementation);
	assert.equal(value.failure.failed, 1);
	assert.equal(value.failure.passed, 0);
	assert.equal(value.failure.location, "tests/helpers/owned-checked-record-published-matrix-tests.mjs:98");
	assert.equal(value.validation.passed, 4);
	assert.equal(value.validation.failed, 0);
	assert.equal(value.validation.skipped, 0);
	assert.equal(value.validation.installedRuntimeExecutions, 0);
	assert.equal(value.validation.inventory.stale, 0);
	assert.equal(value.validation.inventory.refreshed, 0);
	assert.equal(value.originalCheckedRecordCells, 170);
	assert.equal(value.independentSubtypeCells, 32);
	assert.equal(value.independentSubtypeObservations, 22);
	assert.equal(value.independentPublication, "c447fbd2edadda605d98012d15c52550bfc5d2b5");
	assert.equal(value.sources.length, 1);
	for(const source of value.sources)
		assert.equal(sha256(git(["show", implementation + ":" + source.path])), source.sha256);
	const source = await sourceAtFinHistoryMilestone(value.sources[0].path, value.sources[0].sha256);
	assert.ok(source.includes("ownedSubtypeMatrixPublicationImplementation"));
	assert.ok(source.includes("assert.deepEqual(observation, independent.observations[index])"));
	assert.ok(source.includes("assert.equal(changed, 114); assert.equal(count, 170)"));
});

test("Owned publication coexistence writer cannot overwrite retained evidence", async () => {
	const before = await readFile(ownedPublicationCoexistenceHistoryPath);
	const result = spawnSync(process.execPath, ["--max-old-space-size=512"
		, "scripts/update-owned-publication-coexistence-source-history.mjs"]
	, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(ownedPublicationCoexistenceHistoryPath), before);
});
