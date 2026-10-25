/**
 * Authenticate the omitted documentation-gate history and preserve original Core checks.
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
	beforeDependentMatrixDocGateSource
	, dependentMatrixDocGateAddedPaths
	, dependentMatrixDocGateChangedPaths
	, dependentMatrixDocGateImplementationPaths
	, dependentMatrixDocGateCommits
	, dependentMatrixDocGateIntegrationBase
	, dependentMatrixDocGateHistoryPath
	, dependentMatrixDocGateImplementation
	, dependentMatrixDocGateIntegrationPaths
	, dependentMatrixDocGatePredecessor
	, reverseDependentMatrixDocGateUpdate
} from "./dependent-matrix-doc-gate-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(dependentMatrixDocGateHistoryPath));
const predecessor = dependentMatrixDocGatePredecessor;
const implementation = dependentMatrixDocGateImplementation;

test("Dependent matrix doc gate records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "dependent-matrix-doc-gate-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, dependentMatrixDocGateIntegrationBase);
	assert.deepEqual(record.implementationCommits, dependentMatrixDocGateCommits);
	for(const [index, commit] of dependentMatrixDocGateCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", commit]).trim()
			, index === 0 ? predecessor : dependentMatrixDocGateCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...dependentMatrixDocGateImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), dependentMatrixDocGateChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), dependentMatrixDocGateIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), dependentMatrixDocGateAddedPaths);
});

test("Dependent matrix doc gate reverses all five source transitions", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 5);
	const updates = [...record.updates, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? dependentMatrixDocGateIntegrationBase : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseDependentMatrixDocGateUpdate(current, update), original);
		assert.equal(beforeDependentMatrixDocGateSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
});

test("Dependent matrix doc gate preserves runtime and original evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Dependent matrix doc gate refuses unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item => item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseDependentMatrixDocGateUpdate(current, forged));
	assert.equal(beforeDependentMatrixDocGateSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeDependentMatrixDocGateSource("unrelated.mjs", current), current);
});

test("Dependent matrix doc gate writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-dependent-matrix-doc-gate-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-dependent-matrix-doc-gate-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Dependent matrix doc gate restores the original CI workflow endpoint and leaves live gates intact", async () => {
	const path = ".github/workflows/dependent-checked-record-matrix.yml";
	const expected = "1691c7a965d371f980341d1f31979ded63d1d8139871b5d5a7fea410d627677b";
	const live = await readFile(path, "utf8");
	assert.equal(sha256(git(["show", `${implementation}:${path}`]))
		, "2e9c45834933a66ca3868251ffe24b6d3d89fed1f21ffbd69eb9ec37243fca58");
	const original = await sourceAtFinHistoryMilestone(path, expected);
	assert.equal(original, git(["show", `${predecessor}:${path}`]));
	assert.equal(beforeDependentMatrixDocGateSource(path, original, expected), original);
	assert.match(live, /Audit all 68 promoted inventory cells and generated documentation/u);
	assert.ok(live.includes('"scripts/generate-reference-docs.mjs"'));
	assert.ok(live.includes('"scripts/generate-type-docs.mjs"'));
	assert.equal(await readFile(path, "utf8"), live);
	const broken = live + "# unknown edit\n";
	assert.equal(beforeDependentMatrixDocGateSource(path, broken, expected), broken);
});
