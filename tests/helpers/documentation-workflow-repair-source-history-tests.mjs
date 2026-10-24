/**
 * Authenticate the explicit Documentation workflow repair.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeDocumentationWorkflowRepairSource
	, documentationWorkflowRepairAddedPaths
	, documentationWorkflowRepairChangedPaths
	, documentationWorkflowRepairHistoryPath
	, documentationWorkflowRepairImplementation
	, documentationWorkflowRepairIntegrationBase
	, documentationWorkflowRepairIntegrationPaths
	, documentationWorkflowRepairPredecessor
	, reverseDocumentationWorkflowRepairUpdate
} from "./documentation-workflow-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Documentation workflow repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		documentationWorkflowRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "documentation-workflow-repair-source-v1");
	assert.equal(record.predecessorCommit
		, documentationWorkflowRepairPredecessor);
	assert.equal(record.implementationCommit
		, documentationWorkflowRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, documentationWorkflowRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, documentationWorkflowRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, documentationWorkflowRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, documentationWorkflowRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeDocumentationWorkflowRepairSource);
		const previous = git(["show"
			, `${documentationWorkflowRepairPredecessor}:${update.path}`]);
		assert.equal(reverseDocumentationWorkflowRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeDocumentationWorkflowRepairSource);
		const previous = git(["show"
			, `${documentationWorkflowRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseDocumentationWorkflowRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Documentation workflow repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${documentationWorkflowRepairImplementation}^`]).trim()
	, documentationWorkflowRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, documentationWorkflowRepairPredecessor
		, documentationWorkflowRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...documentationWorkflowRepairChangedPaths].sort());
});

test("Documentation workflow repair refreshes exactly 25 pins only", async () => {
	const record = JSON.parse(await readFile(
		documentationWorkflowRepairHistoryPath, "utf8"));
	const update = record.integrationUpdates.find(item =>
		item.path === "docs/type-surface.v1.json");
	assert.ok(update);
	const current = JSON.parse(await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256));
	const previous = JSON.parse(git(["show"
		, `${documentationWorkflowRepairIntegrationBase}:${update.path}`]));
	const expected = new Map([["tests/documentation.test.mjs", 25]]);
	const counts = new Map([...expected.keys()].map(path => [path, 0]));
	assert.equal(current.evidence.length, previous.evidence.length);
	for(const [index, evidence] of current.evidence.entries())
	{
		const oldEvidence = previous.evidence[index];
		assert.equal(evidence.files.length, oldEvidence.files.length);
		for(const [position, file] of evidence.files.entries())
		{
			const old = oldEvidence.files[position];
			assert.equal(file.path, old.path);
			if(expected.has(file.path))
			{
				const source = record.updates.find(item => item.path === file.path);
				assert.ok(source);
				assert.equal(old.sha256, source.previousSha256, file.path);
				const finalSource = record.integrationUpdates.find(item =>
					item.path === file.path) ?? source;
				assert.equal(file.sha256, finalSource.currentSha256, file.path);
				old.sha256 = file.sha256;
				counts.set(file.path, counts.get(file.path) + 1);
			}
			else
			{
				assert.ok(!documentationWorkflowRepairChangedPaths.includes(file.path)
					, `Unexpected source pin requires refresh: ${file.path}`);
				assert.equal(file.sha256, old.sha256, file.path);
			}
		}
	}
	assert.deepEqual(counts, expected);
	assert.deepEqual(current, previous
		, "No support claim or observation may change with this source-pin repair");
});

test("Documentation workflow repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		documentationWorkflowRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeDocumentationWorkflowRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDocumentationWorkflowRepairUpdate(
		current, update));
});

test("Documentation workflow writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-documentation-workflow-repair-history-"));
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
		"scripts/update-documentation-workflow-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
