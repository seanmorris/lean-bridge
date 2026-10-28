/**
 * Authenticate the reviewed Fin selected-job evidence boundary.
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
	beforeReviewedFinJobScopeSource
	, reverseReviewedFinJobScopeUpdate
	, reviewedFinJobScopeAddedPaths
	, reviewedFinJobScopeHistoryPath
	, reviewedFinJobScopeImplementation
	, reviewedFinJobScopeImplementationAddedPaths
	, reviewedFinJobScopeImplementationPaths
	, reviewedFinJobScopeIntegrationAddedPaths
	, reviewedFinJobScopeIntegrationPaths
	, reviewedFinJobScopeNormalizationPaths
	, reviewedFinJobScopePredecessor
} from "./reviewed-fin-job-scope-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 ** 2 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	reviewedFinJobScopeHistoryPath, "utf8"
));

test("reviewed Fin job scope records its exact source range", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "reviewed-fin-job-scope-source-v1");
	assert.equal(record.predecessorCommit, reviewedFinJobScopePredecessor);
	assert.equal(record.implementationCommit, reviewedFinJobScopeImplementation);
	assert.equal(git(["rev-parse"
		, `${reviewedFinJobScopeImplementation}^`]).trim()
		, reviewedFinJobScopePredecessor);
	assert.equal(git(["rev-parse", `${record.integrationCommit}^`]).trim()
		, reviewedFinJobScopeImplementation);
	assert.deepEqual(names(["diff", "--name-only"
		, reviewedFinJobScopePredecessor, reviewedFinJobScopeImplementation]), [
		...reviewedFinJobScopeImplementationAddedPaths
		, ...reviewedFinJobScopeImplementationPaths
		].sort());
	assert.deepEqual(names(["diff", "--name-only"
		, reviewedFinJobScopeImplementation, record.integrationCommit]), [
		...reviewedFinJobScopeIntegrationAddedPaths
		, ...reviewedFinJobScopeIntegrationPaths
		].sort());
	assert.deepEqual(record.updates.map(update => update.path)
		, reviewedFinJobScopeImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, reviewedFinJobScopeIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, reviewedFinJobScopeAddedPaths);
});

test("reviewed Fin job scope is terminal and selected-job specific", () => {
	const helper = git(["show", `${reviewedFinJobScopeImplementation}:tests/helpers/reviewed-fin-wasm-entry-hosted-archive.mjs`]);
	const archive = git(["show", `${reviewedFinJobScopeImplementation}:scripts/archive-reviewed-fin-wasm-entry-hosted.mjs`]);
	assert.match(helper, /assert\.equal\(run\.status, "completed"\)/u);
	for(const conclusion of ["cancelled", "failure", "success"])
		assert.match(helper, new RegExp(`"${conclusion}"`, "u"));
	assert.match(helper
		, /\[job\.status, job\.conclusion\].*\["completed", "success"\]/su);
	assert.match(helper, /runConclusion: run\.conclusion/u);
	assert.match(archive, /no result from another matrix job is claimed/u);
});

test("reviewed Fin job scope reverses every source endpoint", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${reviewedFinJobScopeImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${reviewedFinJobScopePredecessor}:${update.path}`]);
		assert.equal(reverseReviewedFinJobScopeUpdate(current, update), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeReviewedFinJobScopeSource);
		const previous = git(["show"
			, `${reviewedFinJobScopeImplementation}:${update.path}`]);
		assert.equal(reverseReviewedFinJobScopeUpdate(current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const path of reviewedFinJobScopeNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path));
});

test("reviewed Fin job scope leaves product contracts unchanged", () => {
	for(const path of ["docs/type-surface.v1.json"
		, "docs/consumer-support.v1.json", "schema/binding-ir.schema.json"])
		assert.equal(git(["rev-parse"
			, `${reviewedFinJobScopePredecessor}:${path}`])
			, git(["rev-parse"
				, `${reviewedFinJobScopeImplementation}:${path}`]), path);
});

test("reviewed Fin job scope rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${reviewedFinJobScopeImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseReviewedFinJobScopeUpdate(current, forged));
	assert.equal(beforeReviewedFinJobScopeSource("unrelated.mjs", current)
		, current);
});

test("reviewed Fin job scope writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-reviewed-fin-scope-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-reviewed-fin-job-scope-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
