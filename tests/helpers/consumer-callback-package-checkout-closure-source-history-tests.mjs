/**
 * Authenticate the bounded callback package checkout closure.
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
	assertCallbackPackageCheckoutContract
	, beforeConsumerCallbackPackageCheckoutClosureSource
	, consumerCallbackPackageCheckoutClosureAddedPaths
	, consumerCallbackPackageCheckoutClosureHistoryPath
	, consumerCallbackPackageCheckoutClosureImplementation
	, consumerCallbackPackageCheckoutClosureImplementationPaths
	, consumerCallbackPackageCheckoutClosureIntegrationPaths
	, consumerCallbackPackageCheckoutClosureNormalizationPaths
	, consumerCallbackPackageCheckoutClosurePinPaths
	, consumerCallbackPackageCheckoutClosurePinRepair
	, consumerCallbackPackageCheckoutClosurePredecessor
	, consumerCallbackPackageCheckoutJobIds
	, consumerWorkflowJobs
	, reverseConsumerCallbackPackageCheckoutClosureUpdate
} from "./consumer-callback-package-checkout-closure-source-history.mjs";
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
	consumerCallbackPackageCheckoutClosureHistoryPath, "utf8"));

test("callback checkout closure records the exact hosted failure and range"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-callback-package-checkout-closure-v1");
		assert.equal(history.predecessorCommit
			, consumerCallbackPackageCheckoutClosurePredecessor);
		assert.equal(history.implementationCommit
			, consumerCallbackPackageCheckoutClosureImplementation);
		assert.equal(history.pinRepairCommit
			, consumerCallbackPackageCheckoutClosurePinRepair);
		assert.deepEqual(history.failedRun, {
			workflow: 41225209353, job: 124610162218
			, headSha: consumerCallbackPackageCheckoutClosurePredecessor
			, jobName: "Callback-result lifetimes in installed Maven packages"
		});
		assert.equal(history.failure
			, "hosted runner ENOSPC while actions/checkout was active");
		assert.deepEqual(names(["diff", "--name-only"
			, consumerCallbackPackageCheckoutClosurePredecessor
			, consumerCallbackPackageCheckoutClosureImplementation])
			, consumerCallbackPackageCheckoutClosureImplementationPaths);
		assert.deepEqual(names(["diff", "--name-only"
			, consumerCallbackPackageCheckoutClosureImplementation
			, consumerCallbackPackageCheckoutClosurePinRepair])
			, consumerCallbackPackageCheckoutClosurePinPaths);
		assert.deepEqual(history.updates.map(update => update.path)
			, consumerCallbackPackageCheckoutClosureImplementationPaths);
		assert.deepEqual(history.pinUpdates.map(update => update.path)
			, consumerCallbackPackageCheckoutClosurePinPaths);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, consumerCallbackPackageCheckoutClosureIntegrationPaths);
		assert.deepEqual(history.additions.map(addition => addition.path)
			, consumerCallbackPackageCheckoutClosureAddedPaths);
	}
);

test("all eight callback package jobs share the bounded checkout contract"
	, async () => {
		const history = await record();
		assert.deepEqual(history.callbackJobIds
			, consumerCallbackPackageCheckoutJobIds);
		const workflow = git(["show"
			, consumerCallbackPackageCheckoutClosureImplementation
				+ ":.github/workflows/consumer-matrix.yml"]);
		const jobs = consumerWorkflowJobs(workflow);
		const callbacks = [...jobs].filter(([, body]) => body.includes(
			"Free hosted runner disk before callback package builds"));
		assert.deepEqual(callbacks.map(([id]) => id)
			, consumerCallbackPackageCheckoutJobIds);
		for(const [id, job] of callbacks)
		{
			assertCallbackPackageCheckoutContract(id, job);
			for(const malformed of [
				job.replace("fetch-depth: 1", "fetch-depth: 0")
				, job.replace(
					"sparse-checkout: ${{ env.LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT }}"
					, "sparse-checkout: /**")
				, job.replace("sparse-checkout-cone-mode: false"
					, "sparse-checkout-cone-mode: true")
				, job.replace("Free hosted runner disk before callback package builds"
					, "Skip hosted runner cleanup")
			]) assert.throws(() =>
				assertCallbackPackageCheckoutContract(id, malformed), undefined, id);
		}
	}
);

test("callback checkout closure retains source and bounded evidence metadata"
	, async () => {
		const workflow = git(["show"
			, consumerCallbackPackageCheckoutClosureImplementation
				+ ":.github/workflows/consumer-matrix.yml"]);
		const manifest = workflow.match(
			/^ {2}LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT: \|\n((?: {4}.*\n)+)/mu
		)?.[1];
		assert.ok(manifest);
		for(const path of [
			"/*", "!/*/", "/.github/", "/config/", "/nix/", "/scripts/"
			, "/src/", "/tests/", "/docs/", "!/docs/evidence/*"
			, "/docs/evidence/*.json", "/docs/evidence/*.md"
			, "/docs/evidence/*.xml", "/docs/evidence/*/index.json"
		]) assert.match(manifest, new RegExp("^ {4}"
			+ path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "$", "mu"));
		assert.doesNotMatch(manifest, /\/docs\/evidence\/[*][*]/u);
		assert.equal(workflow.split(
			"sparse-checkout: ${{ env.LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT }}"
		).length - 1 >= consumerCallbackPackageCheckoutJobIds.length, true);
	}
);

test("callback checkout closure refreshes exactly 92 live citations"
	, async () => {
		const history = await record();
		assert.deepEqual(history.currentSourcePin, {
			path: ".github/workflows/consumer-matrix.yml", count: 92
			, previous:
				"00c0bd9a424894a0b0e0fecce7e2e6323460c844ceff50b4e89b9e728bdf3ba9"
			, current:
				"ea54e7cbfa9fce0a9c33c1fe86d2e3bfd649fe17fddf5f2f23ba7c6d41c1f47d"
		});
		const before = git(["show"
			, consumerCallbackPackageCheckoutClosureImplementation
				+ ":docs/type-surface.v1.json"]);
		const after = git(["show"
			, consumerCallbackPackageCheckoutClosurePinRepair
				+ ":docs/type-surface.v1.json"]);
		assert.equal(after.split(history.currentSourcePin.current).length - 1
			, 92);
		assert.equal(after.includes(history.currentSourcePin.previous), false);
		assert.equal(after.replaceAll(history.currentSourcePin.current
			, history.currentSourcePin.previous), before);
	}
);

test("callback checkout closure reverses every authenticated source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(reverseConsumerCallbackPackageCheckoutClosureUpdate(
				git(["show"
				, consumerCallbackPackageCheckoutClosureImplementation
					+ ":" + update.path]), update), git(["show"
				, consumerCallbackPackageCheckoutClosurePredecessor
					+ ":" + update.path]), update.path);
		for(const update of history.pinUpdates)
			assert.equal(reverseConsumerCallbackPackageCheckoutClosureUpdate(
				git(["show"
				, consumerCallbackPackageCheckoutClosurePinRepair
					+ ":" + update.path]), update), git(["show"
				, consumerCallbackPackageCheckoutClosureImplementation
					+ ":" + update.path]), update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, consumerCallbackPackageCheckoutClosurePinRepair
					+ ":" + update.path]);
			assert.equal(reverseConsumerCallbackPackageCheckoutClosureUpdate(
				current, update), previous, update.path);
			assert.equal(beforeConsumerCallbackPackageCheckoutClosureSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of consumerCallbackPackageCheckoutClosureNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("callback checkout closure rejects forged history and duplicate writers"
	, async t => {
		const history = await record();
		for(const addition of history.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerCallbackPackageCheckoutClosureImplementation
				+ ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.yml" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerCallbackPackageCheckoutClosureUpdate(current, forged));
		const root = await mkdtemp(join(tmpdir(), "lean-callback-checkout-guard-"));
		t.after(() => rm(root, { recursive: true }));
		const duplicate = spawnSync(process.execPath, [resolve(
			"scripts/update-consumer-callback-package-checkout-closure-source-history.mjs"
		)], { cwd: root, encoding: "utf8", timeout: 15_000 });
		assert.notEqual(duplicate.status, 0);
		assert.equal(duplicate.stdout, "");
		assert.deepEqual(await readdir(root), []);
	}
);
