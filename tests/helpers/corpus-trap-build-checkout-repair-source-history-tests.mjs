/**
 * Authenticate the corpus sampler trap repair, the restored Performance build checkout and their pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeCorpusTrapBuildCheckoutRepairSource
	, corpusTrapBuildCheckoutRepairAddedPaths
	, corpusTrapBuildCheckoutRepairBuildBaseline
	, corpusTrapBuildCheckoutRepairCommits
	, corpusTrapBuildCheckoutRepairCorpusWorkflowPath
	, corpusTrapBuildCheckoutRepairHistoryPath
	, corpusTrapBuildCheckoutRepairImplementation
	, corpusTrapBuildCheckoutRepairImplementationPaths
	, corpusTrapBuildCheckoutRepairIntegrationPaths
	, corpusTrapBuildCheckoutRepairPerformanceWorkflowPath
	, corpusTrapBuildCheckoutRepairPinCounts
	, corpusTrapBuildCheckoutRepairPredecessor
	, corpusTrapBuildCheckoutRepairSourcePaths
	, corpusTrapBuildCheckoutRepairTestPath
	, corpusTrapBuildCheckoutRepairTypeSurfacePath
	, corpusTrapBuildCheckoutRepairWorkflowCommit
	, reverseCorpusTrapBuildCheckoutRepairUpdate
} from "./corpus-trap-build-checkout-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	corpusTrapBuildCheckoutRepairHistoryPath, "utf8"
));
const digestPattern = /[0-9a-f]{64}/gu;
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const suppressedTrap = "          trap 'kill \"$LEAN_BRIDGE_CORPUS_SAMPLER\" 2>/dev/null || true' EXIT\n";
const probedTrap = "          trap 'if kill -0 \"$LEAN_BRIDGE_CORPUS_SAMPLER\" 2>/dev/null; then kill \"$LEAN_BRIDGE_CORPUS_SAMPLER\"; fi' EXIT\n";
const buildJob = workflow => workflow.slice(workflow.indexOf("\n  build:\n")
	, workflow.indexOf("\n  spatial:\n"));

test("corpus trap and build checkout repair records its exact source range", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "corpus-trap-build-checkout-repair-source-v1");
	assert.equal(value.predecessorCommit, corpusTrapBuildCheckoutRepairPredecessor);
	assert.equal(value.implementationCommit, corpusTrapBuildCheckoutRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, corpusTrapBuildCheckoutRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, corpusTrapBuildCheckoutRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(addition => addition.path)
		, corpusTrapBuildCheckoutRepairAddedPaths);
	const range = `${corpusTrapBuildCheckoutRepairPredecessor}`
		+ `..${corpusTrapBuildCheckoutRepairImplementation}`;
	assert.deepEqual(git(["rev-list", "--reverse", range]).trim().split("\n")
	, corpusTrapBuildCheckoutRepairCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, corpusTrapBuildCheckoutRepairPredecessor
		, corpusTrapBuildCheckoutRepairWorkflowCommit]).trim().split("\n")
	, corpusTrapBuildCheckoutRepairSourcePaths);
	assert.deepEqual(git(["diff", "--name-only"
		, corpusTrapBuildCheckoutRepairWorkflowCommit
		, corpusTrapBuildCheckoutRepairImplementation]).trim().split("\n")
	, [corpusTrapBuildCheckoutRepairTypeSurfacePath]);
});

test("corpus trap and build checkout repair reverses every source transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		if(update.path === corpusTrapBuildCheckoutRepairTypeSurfacePath)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				corpusTrapBuildCheckoutRepairImplementation, update.path), update), true);
			continue;
		}
		const current = sourceAt(corpusTrapBuildCheckoutRepairImplementation, update.path);
		const previous = sourceAt(corpusTrapBuildCheckoutRepairPredecessor, update.path);
		assert.equal(reverseCorpusTrapBuildCheckoutRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCorpusTrapBuildCheckoutRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(corpusTrapBuildCheckoutRepairImplementation, update.path);
		assert.equal(reverseCorpusTrapBuildCheckoutRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("corpus trap and build checkout repair refreshes only the two workflow pins", async () => {
	const update = (await record()).updates.find(item =>
		item.path === corpusTrapBuildCheckoutRepairTypeSurfacePath);
	const transitions = new Map(Object.keys(corpusTrapBuildCheckoutRepairPinCounts).map(path => [
		sha256(sourceAt(corpusTrapBuildCheckoutRepairImplementation, path))
		, { path, previous: sha256(sourceAt(corpusTrapBuildCheckoutRepairPredecessor, path)), pins: 0 }
	]));
	for(const edit of update.edits)
	{
		assert.equal(edit.current.replace(digestPattern, "")
			, edit.previous.replace(digestPattern, ""));
		const current = edit.current.match(digestPattern);
		const previous = edit.previous.match(digestPattern);
		assert.equal(current.length, previous.length);
		for(const [index, digest] of current.entries())
		{
			const transition = transitions.get(digest);
			assert.ok(transition, digest);
			assert.equal(previous[index], transition.previous, transition.path);
			++transition.pins;
		}
	}
	for(const { path, pins } of transitions.values())
		assert.equal(pins, corpusTrapBuildCheckoutRepairPinCounts[path], path);
});

test("corpus trap and build checkout repair changes only the three traps and the build checkout", () => {
	const previousCorpus = sourceAt(corpusTrapBuildCheckoutRepairPredecessor
		, corpusTrapBuildCheckoutRepairCorpusWorkflowPath);
	const currentCorpus = sourceAt(corpusTrapBuildCheckoutRepairImplementation
		, corpusTrapBuildCheckoutRepairCorpusWorkflowPath);
	assert.equal(previousCorpus.split(suppressedTrap).length - 1, 3);
	assert.equal(currentCorpus.split(probedTrap).length - 1, 3);
	assert.equal(previousCorpus.replaceAll(suppressedTrap, probedTrap), currentCorpus);
	assert.throws(() => assertStructuralSubtypeWorkflow(previousCorpus, "consumer-matrix.yml"));
	assertStructuralSubtypeWorkflow(currentCorpus, "consumer-matrix.yml");
	assert.doesNotMatch(probedTrap, /set \+e|\|\| true/u);

	const previousPerformance = sourceAt(corpusTrapBuildCheckoutRepairPredecessor
		, corpusTrapBuildCheckoutRepairPerformanceWorkflowPath);
	const currentPerformance = sourceAt(corpusTrapBuildCheckoutRepairImplementation
		, corpusTrapBuildCheckoutRepairPerformanceWorkflowPath);
	const baselineBuild = buildJob(sourceAt(corpusTrapBuildCheckoutRepairBuildBaseline
		, corpusTrapBuildCheckoutRepairPerformanceWorkflowPath));
	assert.equal(buildJob(currentPerformance), baselineBuild);
	assert.notEqual(buildJob(previousPerformance), baselineBuild);
	assert.match(buildJob(currentPerformance), /tests\/native-graph-model\.test\.mjs/u);
	assert.equal(currentPerformance.replace(buildJob(currentPerformance), "")
		, previousPerformance.replace(buildJob(previousPerformance), ""));
	assert.ok(buildJob(currentPerformance).includes(
		"        with:\n          fetch-depth: 0\n          persist-credentials: false\n      - name: Install Node.js\n"));
	assert.doesNotMatch(buildJob(currentPerformance), /sparse-checkout/u);

	const currentTest = sourceAt(corpusTrapBuildCheckoutRepairImplementation
		, corpusTrapBuildCheckoutRepairTestPath);
	assert.ok(currentTest.includes("[\"build\", null]"));
	assert.ok(currentTest.includes("jobs.size - 1"));
});

test("corpus trap and build checkout repair changes no record, support inventory, benchmark or product source", () => {
	for(const path of ["docs/evidence", "src", "poc", "config", "schema", "scripts"
		, "docs/consumer-support.v1.json", "package.json"])
		assert.equal(git(["rev-parse", `${corpusTrapBuildCheckoutRepairPredecessor}:${path}`])
			, git(["rev-parse", `${corpusTrapBuildCheckoutRepairImplementation}:${path}`]), path);
});

test("corpus trap and build checkout repair rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path === corpusTrapBuildCheckoutRepairCorpusWorkflowPath);
	const current = sourceAt(corpusTrapBuildCheckoutRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseCorpusTrapBuildCheckoutRepairUpdate(current, forged));
	assert.equal(beforeCorpusTrapBuildCheckoutRepairSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});
