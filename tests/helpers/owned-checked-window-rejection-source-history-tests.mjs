/**
 * Authenticate six copied-field rejection consumers and preserve historical acceptance.
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
	beforeOwnedCheckedWindowRejectionSource
	, ownedCheckedWindowRejectionAddedPaths
	, ownedCheckedWindowRejectionChangedPaths
	, ownedCheckedWindowRejectionImplementationPaths
	, ownedCheckedWindowRejectionCommits
	, ownedCheckedWindowRejectionIntegrationBase
	, ownedCheckedWindowRejectionHistoryPath
	, ownedCheckedWindowRejectionImplementation
	, ownedCheckedWindowRejectionIntegrationPaths
	, ownedCheckedWindowRejectionPredecessor
	, reverseOwnedCheckedWindowRejectionUpdate
} from "./owned-checked-window-rejection-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedCheckedWindowRejectionHistoryPath));
const predecessor = ownedCheckedWindowRejectionPredecessor;
const implementation = ownedCheckedWindowRejectionImplementation;

test("Owned checked window rejection records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-window-rejection-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, ownedCheckedWindowRejectionIntegrationBase);
	assert.deepEqual(record.implementationCommits, ownedCheckedWindowRejectionCommits);
	for(const [index, commit] of ownedCheckedWindowRejectionCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", commit]).trim()
			, index === 0 ? predecessor : ownedCheckedWindowRejectionCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedCheckedWindowRejectionImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedCheckedWindowRejectionChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedCheckedWindowRejectionIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedCheckedWindowRejectionAddedPaths);
});

test("Owned checked window rejection reverses all eight source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 8);
	const updates = [...record.updates, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? ownedCheckedWindowRejectionIntegrationBase : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedCheckedWindowRejectionUpdate(current, update), original);
		assert.equal(beforeOwnedCheckedWindowRejectionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Owned checked window rejection preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"
		, "docs/type-surface.v1.json"
		, "tests/fixtures/onboarding/owned-checked-records"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned checked window rejection refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedCheckedWindowRejectionUpdate(current, forged));
	assert.equal(beforeOwnedCheckedWindowRejectionSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedCheckedWindowRejectionSource("unrelated.mjs", current), current);
});

test("Owned checked window rejection writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-checked-window-rejection-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-checked-window-rejection-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned checked window rejection binds six callers and leaves runtime acceptance pending", async () => {
	const path = "docs/evidence/owned-checked-window-rejection-20261025.json";
	const qualification = JSON.parse(git(["show", `${implementation}:${path}`]));
	assert.equal(qualification.sourceBaseCommit, predecessor);
	assert.deepEqual(qualification.sources.map(source => source.path), ownedCheckedWindowRejectionChangedPaths);
	assert.deepEqual(qualification.cases.invalidWindow, { lo: 8, hi: 3, repetitions: 10 });
	assert.deepEqual(qualification.cases.acceptedEquality, { lo: 3, hi: 3 });
	assert.equal(qualification.installedProbes.acceptedRuntimeRuns, 0);
	assert.equal(qualification.installedProbes.localGlibc, "2.36");
	assert.equal(qualification.installedProbes.nativeManifestMinimumGlibc, "2.38");
	assert.equal(qualification.pending.length, 3);
	for(const source of qualification.sources)
	{
		const original = git(["show", `${implementation}:${source.path}`]);
		assert.equal(sha256(original), source.sha256, source.path);
		assert.equal(Buffer.byteLength(original), source.bytes, source.path);
		assert.equal(await sourceAtFinHistoryMilestone(source.path, source.sha256), original);
		assert.match(original, /invalid_booking/u);
		assert.match(original, /equal_booking/u);
	}
	for(const extension of ["c", "cpp", "pl", "python.py", "ruby.rb", "rust.rs"])
	{
		const file = "tests/fixtures/structured-types/owned-checked-record-result-only"
			+ (extension.includes(".") ? "-" : ".") + extension;
		assert.equal(git(["rev-parse", `${predecessor}:${file}`])
			, git(["rev-parse", `${implementation}:${file}`]), file);
	}
});

test("Owned checked window rejection writer cannot overwrite retained evidence", async () => {
	const before = await readFile(ownedCheckedWindowRejectionHistoryPath);
	const result = spawnSync(process.execPath, ["--max-old-space-size=512"
		, "scripts/update-owned-checked-window-rejection-source-history.mjs"]
	, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(ownedCheckedWindowRejectionHistoryPath), before);
});
