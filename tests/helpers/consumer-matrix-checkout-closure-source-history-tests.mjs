/**
 * Authenticate the complete consumer-matrix checkout disk closure.
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
	assertConsumerMatrixCheckoutClosure
	, beforeConsumerMatrixCheckoutClosureSource
	, consumerMatrixCheckoutClosureAddedPaths
	, consumerMatrixCheckoutClosureHistoryPath
	, consumerMatrixCheckoutClosureImplementation
	, consumerMatrixCheckoutClosureImplementationPaths
	, consumerMatrixCheckoutClosureIntegrationPaths
	, consumerMatrixCheckoutClosureNormalizationPaths
	, consumerMatrixCheckoutClosurePinPaths
	, consumerMatrixCheckoutClosurePinRepair
	, consumerMatrixCheckoutClosurePredecessor
	, consumerMatrixCheckoutJobCount
	, consumerMatrixIntentionalCompleteCheckoutJobs
	, consumerMatrixJobs
	, consumerMatrixNewSparseCheckoutJobs
	, reverseConsumerMatrixCheckoutClosureUpdate
} from "./consumer-matrix-checkout-closure-source-history.mjs";
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
	consumerMatrixCheckoutClosureHistoryPath, "utf8"));
const implementationWorkflow = () => git(["show"
	, consumerMatrixCheckoutClosureImplementation
		+ ":.github/workflows/consumer-matrix.yml"]);

test("consumer checkout closure records the exact second hosted ENOSPC failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-matrix-checkout-closure-v1");
		assert.equal(history.predecessorCommit
			, consumerMatrixCheckoutClosurePredecessor);
		assert.equal(history.implementationCommit
			, consumerMatrixCheckoutClosureImplementation);
		assert.equal(history.pinRepairCommit
			, consumerMatrixCheckoutClosurePinRepair);
		assert.deepEqual(history.failedRun, {
			workflow: 41227734448, job: 124615494486
			, headSha: consumerMatrixCheckoutClosurePredecessor
			, jobName: "JavaScript and TypeScript receiver packages"
		});
		assert.equal(history.failure
			, "hosted runner ENOSPC while actions/checkout was active");
		assert.deepEqual(names(["diff", "--name-only"
			, consumerMatrixCheckoutClosurePredecessor
			, consumerMatrixCheckoutClosureImplementation])
			, consumerMatrixCheckoutClosureImplementationPaths);
		assert.deepEqual(names(["diff", "--name-only"
			, consumerMatrixCheckoutClosureImplementation
			, consumerMatrixCheckoutClosurePinRepair])
			, consumerMatrixCheckoutClosurePinPaths);
		assert.deepEqual(history.updates.map(update => update.path)
			, consumerMatrixCheckoutClosureImplementationPaths);
		assert.deepEqual(history.pinUpdates.map(update => update.path)
			, consumerMatrixCheckoutClosurePinPaths);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, consumerMatrixCheckoutClosureIntegrationPaths);
		assert.deepEqual(history.additions.map(addition => addition.path)
			, consumerMatrixCheckoutClosureAddedPaths);
	}
);

test("consumer checkout closure inventories every checkout in one pass"
	, async () => {
		const history = await record();
		assert.equal(history.checkoutJobs, consumerMatrixCheckoutJobCount);
		assert.equal(history.sparseCheckoutJobs, 33);
		assert.deepEqual(history.intentionalCompleteCheckoutJobs
			, consumerMatrixIntentionalCompleteCheckoutJobs);
		assert.deepEqual(history.newSparseCheckoutJobs
			, consumerMatrixNewSparseCheckoutJobs);
		const workflow = implementationWorkflow();
		assertConsumerMatrixCheckoutClosure(workflow);
		const jobs = consumerMatrixJobs(workflow);
		for(const id of consumerMatrixIntentionalCompleteCheckoutJobs)
		{
			const body = jobs.get(id);
			const malformedBody = body.replace(
				"Free hosted runner disk before complete history checkout"
				, "Skip complete history cleanup");
			const malformed = workflow.replace(body, () => malformedBody);
			assert.throws(() =>
				assertConsumerMatrixCheckoutClosure(malformed), undefined, id);
		}
		for(const id of consumerMatrixNewSparseCheckoutJobs)
		{
			const body = jobs.get(id);
			for(const malformedBody of [
				body.replace("fetch-depth: 1", "fetch-depth: 0")
				, body.replace(
					"sparse-checkout: ${{ env.LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT }}"
					, "sparse-checkout: /**")
				, body.replace("sparse-checkout-cone-mode: false"
					, "sparse-checkout-cone-mode: true")
			]) assert.throws(() => assertConsumerMatrixCheckoutClosure(
				workflow.replace(body, () => malformedBody)), undefined, id);
		}
		assert.throws(() => assertConsumerMatrixCheckoutClosure(workflow
			+ "\n  accidental-complete:\n    steps:\n"
			+ "      - uses: actions/checkout@v6\n"));
	}
);

test("consumer checkout closure advances exactly 92 current workflow pins"
	, async () => {
		const history = await record();
		assert.deepEqual(history.currentSourcePin, {
			path: ".github/workflows/consumer-matrix.yml", count: 92
			, previous:
				"ea54e7cbfa9fce0a9c33c1fe86d2e3bfd649fe17fddf5f2f23ba7c6d41c1f47d"
			, current:
				"c729331a3cebe4f35c14eb0fae196997fb7cba4abd2ddc412c47dcaae284ba48"
		});
		const before = git(["show"
		, consumerMatrixCheckoutClosureImplementation
			+ ":docs/type-surface.v1.json"]);
		const after = git(["show"
		, consumerMatrixCheckoutClosurePinRepair
			+ ":docs/type-surface.v1.json"]);
		assert.equal(after.split(history.currentSourcePin.current).length - 1
			, 92);
		assert.equal(after.includes(history.currentSourcePin.previous), false);
		assert.equal(after.replaceAll(history.currentSourcePin.current
			, history.currentSourcePin.previous), before);
	}
);

test("consumer checkout closure reverses every authenticated source"
	, async () => {
		const history = await record();
		for(const [updates, current, previous] of [
			[history.updates, consumerMatrixCheckoutClosureImplementation
				, consumerMatrixCheckoutClosurePredecessor]
			, [history.pinUpdates, consumerMatrixCheckoutClosurePinRepair
				, consumerMatrixCheckoutClosureImplementation]
		]) for(const update of updates)
			assert.equal(reverseConsumerMatrixCheckoutClosureUpdate(
				git(["show", current + ":" + update.path]), update)
				, git(["show", previous + ":" + update.path]), update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
			, consumerMatrixCheckoutClosurePinRepair
				+ ":" + update.path]);
			assert.equal(reverseConsumerMatrixCheckoutClosureUpdate(
				current, update), previous, update.path);
			assert.equal(beforeConsumerMatrixCheckoutClosureSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of consumerMatrixCheckoutClosureNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("consumer checkout closure rejects forged history and duplicate writers"
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
			reverseConsumerMatrixCheckoutClosureUpdate(current, forged));
		const root = await mkdtemp(join(tmpdir(), "lean-consumer-checkout-guard-"));
		t.after(() => rm(root, { recursive: true }));
		const duplicate = spawnSync(process.execPath, [resolve(
			"scripts/update-consumer-matrix-checkout-closure-source-history.mjs"
		)], { cwd: root, encoding: "utf8", timeout: 15_000 });
		assert.notEqual(duplicate.status, 0);
		assert.equal(duplicate.stdout, "");
		assert.deepEqual(await readdir(root), []);
	}
);
