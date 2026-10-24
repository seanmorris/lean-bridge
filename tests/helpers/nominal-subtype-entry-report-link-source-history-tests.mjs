/**
 * Authenticate the nominal Subtype entry report/link-manifest boundary.
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
	beforeNominalSubtypeEntryReportLinkSource
	, nominalSubtypeEntryReportLinkAddedPaths
	, nominalSubtypeEntryReportLinkChangedPaths
	, nominalSubtypeEntryReportLinkHistoryPath
	, nominalSubtypeEntryReportLinkImplementation
	, nominalSubtypeEntryReportLinkIntegrationPaths
	, nominalSubtypeEntryReportLinkPredecessor
	, reverseNominalSubtypeEntryReportLinkUpdate
} from "./nominal-subtype-entry-report-link-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("nominal entry report/link history restores every source", async () => {
	const record = JSON.parse(await readFile(
		nominalSubtypeEntryReportLinkHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "nominal-subtype-entry-report-link-source-v1");
	assert.equal(record.predecessorCommit
		, nominalSubtypeEntryReportLinkPredecessor);
	assert.equal(record.implementationCommit
		, nominalSubtypeEntryReportLinkImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, nominalSubtypeEntryReportLinkChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, nominalSubtypeEntryReportLinkIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, nominalSubtypeEntryReportLinkAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeNominalSubtypeEntryReportLinkSource);
		const previous = git(["show"
			, `${nominalSubtypeEntryReportLinkPredecessor}:${update.path}`]);
		assert.equal(reverseNominalSubtypeEntryReportLinkUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeNominalSubtypeEntryReportLinkSource);
		const previous = git(["show"
			, `${nominalSubtypeEntryReportLinkImplementation}:${update.path}`]);
		assert.equal(reverseNominalSubtypeEntryReportLinkUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("nominal entry report/link authentication is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${nominalSubtypeEntryReportLinkImplementation}^`]).trim()
	, nominalSubtypeEntryReportLinkPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, nominalSubtypeEntryReportLinkPredecessor
		, nominalSubtypeEntryReportLinkImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...nominalSubtypeEntryReportLinkChangedPaths].sort());
});

test("nominal entry report/link history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		nominalSubtypeEntryReportLinkHistoryPath, "utf8"));
	for(const original of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(original.path
			, original.currentSha256
			, beforeNominalSubtypeEntryReportLinkSource);
		const update = structuredClone(original);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseNominalSubtypeEntryReportLinkUpdate(
			current, update), original.path);
	}
});

test("nominal entry report/link writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-nominal-entry-report-link-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nominal-subtype-entry-report-link-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
