/**
 * Authenticate the final component reproducibility review closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeVo1220ComponentReproducibilityReviewClosureSource
	, reverseVo1220ComponentReproducibilityReviewClosureUpdate
	, vo1220ComponentReproducibilityReviewClosureAddedPaths
	, vo1220ComponentReproducibilityReviewClosureHistoryPath
	, vo1220ComponentReproducibilityReviewClosureImplementation
	, vo1220ComponentReproducibilityReviewClosureImplementationPaths
	, vo1220ComponentReproducibilityReviewClosureIntegrationPaths
	, vo1220ComponentReproducibilityReviewClosureNormalizationPaths
	, vo1220ComponentReproducibilityReviewClosurePredecessor
} from "./vo1220-component-reproducibility-review-closure-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220ComponentReproducibilityReviewClosureHistoryPath, "utf8"));

test("component reproducibility review closure records both exact findings", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-component-reproducibility-review-closure-v1");
	assert.equal(history.predecessorCommit
		, vo1220ComponentReproducibilityReviewClosurePredecessor);
	assert.equal(history.implementationCommit
		, vo1220ComponentReproducibilityReviewClosureImplementation);
	assert.deepEqual(history.review, {
		pullRequest: 10
		, commit: vo1220ComponentReproducibilityReviewClosurePredecessor
		, findings: [
			{ comment: 4555380448, severity: "high" }
			, { comment: 4555380527, severity: "medium" }
		]
	});
	assert.equal(history.independentAfterSourceRemoval, true);
	assert.equal(history.removedInvalidAssertions, 2);
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ComponentReproducibilityReviewClosureImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ComponentReproducibilityReviewClosureIntegrationPaths);
});

test("component reproducibility clones own borrowed objects and tests preserve policy scope", () => {
	const gate = sourceAt(vo1220ComponentReproducibilityReviewClosureImplementation
		, "src/release/component-reproducibility-gate.mjs");
	const lake = sourceAt(vo1220ComponentReproducibilityReviewClosureImplementation
		, "tests/lake-component-input.test.mjs");
	const canonical = sourceAt(vo1220ComponentReproducibilityReviewClosureImplementation
		, "tests/canonical-build.test.mjs");
	assert.match(gate
		, /"clone", "--quiet", "--local", "--dissociate", "--no-checkout"/u);
	assert.match(lake, /borrowed-objects/u);
	assert.match(lake, /"fsck", "--connectivity-only"/u);
	assert.match(lake, /\.git\/objects\/info\/alternates/u);
	const componentTest = canonical.slice(
		canonical.indexOf("a plain project runs the same closed request"),
		canonical.indexOf("Docker orchestration returns one validated bundle"));
	assert.match(componentTest, /imageBuild\.outputPolicy/u);
	assert.doesNotMatch(componentTest, /run\.outputPolicy/u);
	assert.doesNotMatch(componentTest, /run\.maximumOutputBytes/u);
});

test("component reproducibility review closure reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(
			vo1220ComponentReproducibilityReviewClosureImplementation
			, update.path);
		const previous = sourceAt(
			vo1220ComponentReproducibilityReviewClosurePredecessor
			, update.path);
		assert.equal(reverseVo1220ComponentReproducibilityReviewClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220ComponentReproducibilityReviewClosureSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			vo1220ComponentReproducibilityReviewClosureImplementation
			, update.path);
		assert.equal(reverseVo1220ComponentReproducibilityReviewClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220ComponentReproducibilityReviewClosureSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ComponentReproducibilityReviewClosureNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("component reproducibility review history rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ComponentReproducibilityReviewClosureAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(vo1220ComponentReproducibilityReviewClosureImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ComponentReproducibilityReviewClosureUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-component-repro-review-guard-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-component-reproducibility-review-closure-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
