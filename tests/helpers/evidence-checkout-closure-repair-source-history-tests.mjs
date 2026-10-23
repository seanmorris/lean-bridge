/**
 * Authenticate the evidence-checkout and npm entry-probe repair history.
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
	beforeEvidenceCheckoutClosureRepairSource
	, evidenceCheckoutClosureRepairAddedPaths
	, evidenceCheckoutClosureRepairCommits
	, evidenceCheckoutClosureRepairHistoryPath
	, evidenceCheckoutClosureRepairImplementation
	, evidenceCheckoutClosureRepairImplementationAdditions
	, evidenceCheckoutClosureRepairImplementationPaths
	, evidenceCheckoutClosureRepairIntegrationPaths
	, evidenceCheckoutClosureRepairModifiedPaths
	, evidenceCheckoutClosureRepairNormalizationPaths
	, evidenceCheckoutClosureRepairPredecessor
	, reverseEvidenceCheckoutClosureRepairUpdate
} from "./evidence-checkout-closure-repair-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const gitBytes = arguments_ => execFileSync("git", arguments_, {
	maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(
	evidenceCheckoutClosureRepairHistoryPath, "utf8"));
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);

test("evidence checkout closure history restores every text transition", async () => {
	const data = await record();
	assert.equal(data.schemaVersion, 1);
	assert.equal(data.milestone, "evidence-checkout-closure-repair-v1");
	assert.equal(data.predecessorCommit, evidenceCheckoutClosureRepairPredecessor);
	assert.equal(data.implementationCommit, evidenceCheckoutClosureRepairImplementation);
	assert.deepEqual(data.implementationCommits, evidenceCheckoutClosureRepairCommits);
	assert.deepEqual(data.updates.map(item => item.path)
		, evidenceCheckoutClosureRepairModifiedPaths);
	assert.deepEqual(data.implementationAdditions.map(item => item.path)
		, evidenceCheckoutClosureRepairImplementationAdditions);
	assert.deepEqual(data.integrationUpdates.map(item => item.path)
		, evidenceCheckoutClosureRepairIntegrationPaths);
	assert.deepEqual(data.additions.map(item => item.path)
		, evidenceCheckoutClosureRepairAddedPaths);
	for(const update of data.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show", `${evidenceCheckoutClosureRepairPredecessor}:${update.path}`]);
		assert.equal(current, git(["show", `${evidenceCheckoutClosureRepairImplementation}:${update.path}`]), update.path);
		assert.equal(reverseEvidenceCheckoutClosureRepairUpdate(current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of data.integrationUpdates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show", `${evidenceCheckoutClosureRepairImplementation}:${update.path}`]);
		assert.equal(reverseEvidenceCheckoutClosureRepairUpdate(current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
});

test("evidence checkout closure history authenticates both implementation commits and every added byte", async () => {
	const data = await record();
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${evidenceCheckoutClosureRepairPredecessor}..${evidenceCheckoutClosureRepairImplementation}`])
		.trim().split("\n"), evidenceCheckoutClosureRepairCommits);
	assert.deepEqual(names(["diff", "--name-only"
		, evidenceCheckoutClosureRepairPredecessor
		, evidenceCheckoutClosureRepairImplementation])
		, [...evidenceCheckoutClosureRepairImplementationPaths].sort());
	for(const addition of data.implementationAdditions)
		assert.equal(sha256(gitBytes(["show"
			, `${evidenceCheckoutClosureRepairImplementation}:${addition.path}`]))
		, addition.currentSha256, addition.path);
	for(const addition of data.additions)
		assert.equal(sha256(await atMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("evidence checkout closure history rejects altered transitions", async () => {
	const data = await record();
	const update = structuredClone(data.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update); forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseEvidenceCheckoutClosureRepairUpdate(current, forged));
	const shifted = structuredClone(update); shifted.edits[0].start += 1;
	assert.throws(() => reverseEvidenceCheckoutClosureRepairUpdate(current, shifted));
	assert.equal(beforeEvidenceCheckoutClosureRepairSource(update.path, `${current}unrelated\n`)
		, `${current}unrelated\n`);
	assert.equal(beforeEvidenceCheckoutClosureRepairSource("docs/unrelated.md", current), current);
	assert.ok(evidenceCheckoutClosureRepairNormalizationPaths.includes(update.path));
});

test("evidence checkout closure history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-evidence-checkout-closure-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c"
		, "commit.gpgsign=false"
		, "commit"
		, "--allow-empty"
		, "--quiet"
		, "-m"
		, "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-evidence-checkout-closure-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
