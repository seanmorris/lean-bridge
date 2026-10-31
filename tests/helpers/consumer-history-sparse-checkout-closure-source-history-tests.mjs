/**
 * Authenticate the history-aware consumer sparse-checkout closure.
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
	assertConsumerHistorySparseCheckoutClosure
	, beforeConsumerHistorySparseCheckoutClosureSource
	, consumerHistoryCheckoutJobCount
	, consumerHistoryJobs
	, consumerHistoryNewSparseCheckoutJobs
	, consumerHistorySparseCheckoutClosureAddedPaths
	, consumerHistorySparseCheckoutClosureHistoryPath
	, consumerHistorySparseCheckoutClosureImplementation
	, consumerHistorySparseCheckoutClosureImplementationPaths
	, consumerHistorySparseCheckoutClosureIntegrationPaths
	, consumerHistorySparseCheckoutClosureNormalizationPaths
	, consumerHistorySparseCheckoutClosurePinPaths
	, consumerHistorySparseCheckoutClosurePinRepair
	, consumerHistorySparseCheckoutClosurePredecessor
	, consumerHistorySparseCheckoutJobs
	, reverseConsumerHistorySparseCheckoutClosureUpdate
} from "./consumer-history-sparse-checkout-closure-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const record = async () => JSON.parse(await readFile(
	consumerHistorySparseCheckoutClosureHistoryPath, "utf8"));
const implementationWorkflow = () => git(["show"
	, consumerHistorySparseCheckoutClosureImplementation
		+ ":.github/workflows/consumer-matrix.yml"]);

test("history-aware checkout closure records the exact third hosted ENOSPC failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-history-sparse-checkout-closure-v1");
		assert.equal(history.predecessorCommit
			, consumerHistorySparseCheckoutClosurePredecessor);
		assert.equal(history.implementationCommit
			, consumerHistorySparseCheckoutClosureImplementation);
		assert.equal(history.pinRepairCommit
			, consumerHistorySparseCheckoutClosurePinRepair);
		assert.deepEqual(history.failedRun, {
			workflow: 41230798417, job: 124624546320
			, headSha: consumerHistorySparseCheckoutClosurePredecessor
			, jobName: "Native PHP callback-result acceptance"
		});
		assert.equal(history.failure
			, "hosted runner ENOSPC while actions/checkout was active");
		assert.deepEqual(names(["diff", "--name-only"
			, consumerHistorySparseCheckoutClosurePredecessor
			, consumerHistorySparseCheckoutClosureImplementation])
			, consumerHistorySparseCheckoutClosureImplementationPaths);
		assert.deepEqual(names(["diff", "--name-only"
			, consumerHistorySparseCheckoutClosureImplementation
			, consumerHistorySparseCheckoutClosurePinRepair])
			, consumerHistorySparseCheckoutClosurePinPaths);
		assert.deepEqual(history.updates.map(update => update.path)
			, consumerHistorySparseCheckoutClosureImplementationPaths);
		assert.deepEqual(history.pinUpdates.map(update => update.path)
			, consumerHistorySparseCheckoutClosurePinPaths);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, consumerHistorySparseCheckoutClosureIntegrationPaths);
		assert.deepEqual(history.additions.map(addition => addition.path)
			, consumerHistorySparseCheckoutClosureAddedPaths);
	}
);

test("history-aware checkout closure covers every full-history job in one pass"
	, async () => {
		const history = await record();
		assert.equal(history.checkoutJobs, consumerHistoryCheckoutJobCount);
		assert.equal(history.sparseCheckoutJobs, consumerHistoryCheckoutJobCount);
		assert.deepEqual(history.historySparseCheckoutJobs
			, consumerHistorySparseCheckoutJobs);
		assert.deepEqual(history.newSparseCheckoutJobs
			, consumerHistoryNewSparseCheckoutJobs);
		const workflow = implementationWorkflow();
		assertConsumerHistorySparseCheckoutClosure(workflow);
		const jobs = consumerHistoryJobs(workflow);
		for(const id of consumerHistorySparseCheckoutJobs)
		{
			const body = jobs.get(id);
			for(const malformedBody of [
				body.replace("fetch-depth: 0", "fetch-depth: 1")
				, body.replace("filter: blob:none", "filter: blob:limit=1m")
				, body.replace("persist-credentials: false"
					, "persist-credentials: true")
				, body.replace("sparse-checkout-cone-mode: false"
					, "sparse-checkout-cone-mode: true")
			]) assert.throws(() => assertConsumerHistorySparseCheckoutClosure(
				workflow.replace(body, () => malformedBody)), undefined, id);
		}
		for(const id of consumerHistoryNewSparseCheckoutJobs)
		{
			const body = jobs.get(id);
			const malformedBody = body.replace(/^ {10}sparse-checkout:.*\n/mu, "");
			assert.throws(() => assertConsumerHistorySparseCheckoutClosure(
				workflow.replace(body, () => malformedBody)), undefined, id);
		}
		for(const pattern of [
			"/docs/evidence/**/*.json", "/docs/evidence/**/*.md"
			, "/docs/evidence/**/*.xml"
		]) assert.throws(() => assertConsumerHistorySparseCheckoutClosure(
			workflow.replace(`    ${pattern}\n`, "")), undefined, pattern);
		assert.throws(() => assertConsumerHistorySparseCheckoutClosure(workflow
			+ "\n  accidental-complete:\n    steps:\n"
			+ "      - uses: actions/checkout@v6\n"));
	}
);

test("history-aware checkout closure advances exactly 92 current workflow pins"
	, async () => {
		const history = await record();
		assert.deepEqual(history.currentSourcePin, {
			path: ".github/workflows/consumer-matrix.yml", count: 92
			, previous:
				"c729331a3cebe4f35c14eb0fae196997fb7cba4abd2ddc412c47dcaae284ba48"
			, current:
				"3f42de7adffc19c47844f0768be3451e810e8f51ac5a6ca83cee7af3f45001c2"
		});
		const before = git(["show"
			, consumerHistorySparseCheckoutClosureImplementation
				+ ":docs/type-surface.v1.json"]);
		const after = git(["show"
			, consumerHistorySparseCheckoutClosurePinRepair
				+ ":docs/type-surface.v1.json"]);
		assert.equal(after.split(history.currentSourcePin.current).length - 1
			, 92);
		assert.equal(after.includes(history.currentSourcePin.previous), false);
		assert.equal(after.replaceAll(history.currentSourcePin.current
			, history.currentSourcePin.previous), before);
	}
);

test("history-aware checkout closure reverses every authenticated source"
	, async () => {
		const history = await record();
		for(const [updates, current, previous] of [
			[history.updates, consumerHistorySparseCheckoutClosureImplementation
				, consumerHistorySparseCheckoutClosurePredecessor]
			, [history.pinUpdates, consumerHistorySparseCheckoutClosurePinRepair
				, consumerHistorySparseCheckoutClosureImplementation]
		]) for(const update of updates)
			assert.equal(reverseConsumerHistorySparseCheckoutClosureUpdate(
				git(["show", current + ":" + update.path]), update)
					, git(["show", previous + ":" + update.path]), update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, consumerHistorySparseCheckoutClosurePinRepair
					+ ":" + update.path]);
			assert.equal(reverseConsumerHistorySparseCheckoutClosureUpdate(
				current, update), previous, update.path);
			assert.equal(beforeConsumerHistorySparseCheckoutClosureSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of consumerHistorySparseCheckoutClosureNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("history-aware checkout closure rejects forged history and duplicate writers"
	, async t => {
		const history = await record();
		for(const addition of history.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = implementationWorkflow();
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerHistorySparseCheckoutClosureUpdate(current, forged));
		const root = await mkdtemp(join(tmpdir(), "lean-history-sparse-guard-"));
		t.after(() => rm(root, { recursive: true }));
		const duplicate = spawnSync(process.execPath, [resolve(
			"scripts/update-consumer-history-sparse-checkout-closure-source-history.mjs"
		)], { cwd: root, encoding: "utf8", timeout: 15_000 });
		assert.notEqual(duplicate.status, 0);
		assert.equal(duplicate.stdout, "");
		assert.deepEqual(await readdir(root), []);
	}
);
