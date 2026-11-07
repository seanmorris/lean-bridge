/**
 * Authenticate the reviewed-Subtype live/archive expectation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertReviewedSubtypeLiveExpectationRepair
	, beforeReviewedSubtypeLiveExpectationSource
	, reviewedSubtypeLiveExpectationBehavior
	, reviewedSubtypeLiveExpectationHistoryAdditions
	, reviewedSubtypeLiveExpectationHistoryPath
	, reviewedSubtypeLiveExpectationImplementation
	, reviewedSubtypeLiveExpectationImplementationPaths
	, reviewedSubtypeLiveExpectationIntegrationPaths
	, reviewedSubtypeLiveExpectationNormalizationPaths
	, reviewedSubtypeLiveExpectationPredecessor
	, reverseReviewedSubtypeLiveExpectationUpdate
} from "./reviewed-subtype-live-expectation-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	reviewedSubtypeLiveExpectationHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	reviewedSubtypeLiveExpectationImplementationPaths.map(path => [
		path, blob(reviewedSubtypeLiveExpectationImplementation, path)
	])
);

test("reviewed Subtype live expectation records the exact failed candidate and scope"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "reviewed-subtype-live-expectation-v1");
		assert.equal(value.predecessorCommit
			, reviewedSubtypeLiveExpectationPredecessor);
		assert.equal(value.implementationCommit
			, reviewedSubtypeLiveExpectationImplementation);
		assert.equal(git(["rev-parse"
			, `${reviewedSubtypeLiveExpectationImplementation}^`]).trim()
			, reviewedSubtypeLiveExpectationPredecessor);
		assert.deepEqual(value.updates.map(update => update.path)
			, reviewedSubtypeLiveExpectationImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, reviewedSubtypeLiveExpectationIntegrationPaths);
		assert.deepEqual(value.behavior
			, { ...reviewedSubtypeLiveExpectationBehavior });
		assert.equal(value.discovery.run, 42307044361);
		assert.equal(value.discovery.firstJob, 128206501326);
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("reviewed Subtype live expectation binds every explicit caller epoch", () => {
	const sources = implementationSources();
	assert.deepEqual(assertReviewedSubtypeLiveExpectationRepair(sources)
		, { ...reviewedSubtypeLiveExpectationBehavior });
	const reportPath = "tests/helpers/reviewed-subtype-host-report.mjs";
	const report = sources[reportPath];
	for(const [label, changed] of [
		["open expectation"
			, report.replace(
			"[\"current\", \"2026-10-10\"].includes(expectation)"
			, "typeof expectation === \"string\"")
		]
		, ["current uses frozen review"
			, report.replace(
			"expectation === \"current\" ? reviewedSubtypeHostIr()"
			, "expectation === \"current\" ? reviewedSubtypeHistoricalHostIr()")
		]
		, ["current uses historical selector"
			, report.replace(
			"? reviewedSourceSelection(identity.reviewedBindingIr)"
			, "? historicalReviewedSelection(identity.reviewedBindingIr, review)")
		]
	]) {
		assert.notEqual(changed, report, label);
		assert.throws(() => assertReviewedSubtypeLiveExpectationRepair({
			...sources, [reportPath]: changed
		}), { name: "AssertionError" }, label);
	}
	const runnerPath = "scripts/run-reviewed-subtype-host-ci.sh";
	assert.throws(() => assertReviewedSubtypeLiveExpectationRepair({
		...sources, [runnerPath]: sources[runnerPath].replace(
			"--expectation current", "--expectation 2026-10-10")
	}), { name: "AssertionError" });
});

test("reviewed Subtype live expectation reverses implementation and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(reviewedSubtypeLiveExpectationImplementation
				, update.path);
			const previous = blob(reviewedSubtypeLiveExpectationPredecessor
				, update.path);
			assert.equal(reverseReviewedSubtypeLiveExpectationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				reviewedSubtypeLiveExpectationHistoryPath, update.path
				, update.currentSha256);
			const previous = blob(reviewedSubtypeLiveExpectationImplementation
				, update.path);
			assert.equal(reverseReviewedSubtypeLiveExpectationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of reviewedSubtypeLiveExpectationNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("reviewed Subtype live expectation refreshes only source pins", async () => {
	const value = await record();
	const update = value.integrationUpdates.find(item =>
		item.path === inventoryPath);
	const current = JSON.parse(await sourceAtFinHistoryRecordSource(
		reviewedSubtypeLiveExpectationHistoryPath, inventoryPath
		, update.currentSha256));
	const previous = JSON.parse(blob(
		reviewedSubtypeLiveExpectationImplementation, inventoryPath));
	assert.deepEqual(current.observations, previous.observations);
	assert.equal(current.evidence.length, previous.evidence.length);
	let changed = 0;
	for(const [index, evidence] of current.evidence.entries())
		for(const [position, file] of evidence.files.entries())
		{
			const before = previous.evidence[index].files[position];
			assert.equal(file.path, before.path);
			if(file.sha256 === before.sha256) continue;
			assert.equal(file.sha256, value.refreshed[file.path].currentSha256);
			changed++;
		}
	assert.equal(changed, Object.values(value.refreshed)
		.reduce((total, item) => total + item.occurrences, 0));
	assert.deepEqual(value.exactModel, {
		sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, bytes: 16916757, cells: 1054, stageEntries: 5270
	});
});

test("reviewed Subtype live expectation authenticates additions and rejects forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, reviewedSubtypeLiveExpectationHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${reviewedSubtypeLiveExpectationImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		const update = value.updates[0];
		const current = blob(reviewedSubtypeLiveExpectationImplementation
			, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseReviewedSubtypeLiveExpectationUpdate(
			current, forged));
		assert.equal(beforeReviewedSubtypeLiveExpectationSource(
			"unknown.mjs", current), current);
		const copy = spawnSync(process.execPath, [
			"scripts/update-reviewed-subtype-live-expectation-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
