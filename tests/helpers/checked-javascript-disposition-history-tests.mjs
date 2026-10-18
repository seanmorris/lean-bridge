/**
 * Bind the checked-JavaScript disposition repair to exact source bytes and
 * refreshed historical source pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeRecursiveNativeGraphLoaderIsolationSource
	, recursiveNativeGraphLoaderIsolationAddedPaths
	, recursiveNativeGraphLoaderIsolationChangedPaths
	, recursiveNativeGraphLoaderIsolationHistoryPath
	, recursiveNativeGraphLoaderIsolationPredecessor
	, reverseRecursiveNativeGraphLoaderIsolationUpdate
} from "./recursive-native-graph-loader-isolation-source-history.mjs";
import {
	beforeRecursiveNativeGraphVerifierRepairSource
	, recursiveNativeGraphVerifierRepairAddedPaths
	, recursiveNativeGraphVerifierRepairChangedPaths
	, recursiveNativeGraphVerifierRepairHistoryPath
	, recursiveNativeGraphVerifierRepairPredecessor
	, reverseRecursiveNativeGraphVerifierRepairUpdate
} from "./recursive-native-graph-verifier-repair-source-history.mjs";
import {
	beforeRecursiveNativeSelectorRepairSource
	, recursiveNativeSelectorRepairAddedPaths
	, recursiveNativeSelectorRepairChangedPaths
	, recursiveNativeSelectorRepairHistoryPath
	, recursiveNativeSelectorRepairPredecessor
	, reverseRecursiveNativeSelectorRepairUpdate
} from "./recursive-native-selector-repair-source-history.mjs";
import {
	beforeCallbackFinGateRepairSource
	, callbackFinGateRepairAddedPaths
	, callbackFinGateRepairChangedPaths
	, callbackFinGateRepairHistoryPath
	, callbackFinGateRepairPredecessor
	, reverseCallbackFinGateRepairUpdate
} from "./callback-fin-gate-repair-source-history.mjs";
import {
	beforeCheckedJavaScriptDispositionSource
	, checkedJavaScriptDispositionAddedPaths
	, checkedJavaScriptDispositionCurrentChangedPaths
	, checkedJavaScriptDispositionHistoryPath
	, checkedJavaScriptDispositionHistoricalPaths
	, checkedJavaScriptDispositionPredecessor
	, reverseCheckedJavaScriptDispositionUpdate
} from "./checked-javascript-disposition-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeDownstreamFinCiRepairHistoricalSource
	, beforeDownstreamFinCiRepairSource
	, downstreamFinCiRepairAddedPaths
	, downstreamFinCiRepairChangedPaths
	, downstreamFinCiRepairHistoricalPaths
	, downstreamFinCiRepairHistoryPath
	, downstreamFinCiRepairPredecessor
	, downstreamFinCiRepairPriorPinRepairs
	, downstreamFinCiRepairRerunEvidence
	, reverseDownstreamFinCiRepairUpdate
} from "./downstream-fin-ci-repair-source-history.mjs";
import {
	beforeHistoryHubReachabilityRepairSource
	, historyHubReachabilityRepairAddedPaths
	, historyHubReachabilityRepairChangedPaths
	, historyHubReachabilityRepairHistoryPath
	, historyHubReachabilityRepairPredecessor
	, reverseHistoryHubReachabilityRepairUpdate
} from "./history-hub-reachability-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

test("checked-JavaScript disposition repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedJavaScriptDispositionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-javascript-disposition-source-v1");
	assert.equal(record.predecessorCommit
		, checkedJavaScriptDispositionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedJavaScriptDispositionCurrentChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedJavaScriptDispositionAddedPaths);
	assert.equal(record.pathsSha256
		, sha256(JSON.stringify(checkedJavaScriptDispositionCurrentChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedJavaScriptDispositionSource);
		const previous = git(["show"
			, `${checkedJavaScriptDispositionPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedJavaScriptDispositionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedJavaScriptDispositionSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedJavaScriptDispositionSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeCheckedJavaScriptDispositionSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => {
				if(item.edits) item.edits[0].current += "unknown";
				else item.replacements[0].current = "0".repeat(64);
			}
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedJavaScriptDispositionUpdate(
				current, changed));
		}
	}
});

test("checked-JavaScript disposition closes prior unrecorded Core transitions", async () => {
	const record = JSON.parse(await readFile(
		checkedJavaScriptDispositionHistoryPath, "utf8"));
	const expected = [
		["b79328f845381df3d29e640a786dc6ce5c655d1f"
			, "ea1cf3ac43f125c8648b2e8d32e064b30ad3eec3"
			, ["tests/helpers/nominal-primitive-subtype-tests.mjs"]]
		, ["18bcdff78d98a15d1b5fbacac7654b305a8d5f9c"
			, "b79328f845381df3d29e640a786dc6ce5c655d1f"
			, ["tests/helpers/nominal-primitive-subtype-tests.mjs"]]
		, ["f6c632d18f48ec14eaafe2c0bbecfc10672217bd"
			, "ecb7e22ed0e106bad8184d9a058e3511e2545420"
			, ["tests/helpers/nominal-primitive-subtype-tests.mjs"]]
		, ["0da829c7e1c767a28b4dd7ae7a9cd2c5ac8871d8"
			, "0f4c7b519a7a40d8298dba442ee6614a217f1a0e"
			, ["tests/helpers/nominal-primitive-subtype-tests.mjs"]]
		, ["b24dcd2606e959caebd7d152c2554b6d7a46e157"
			, "0da829c7e1c767a28b4dd7ae7a9cd2c5ac8871d8"
			, ["tests/helpers/nominal-primitive-subtype-tests.mjs"]]
		, ["5676f6cabdf71f38c777f408ed25e3c74801e5db"
			, "cf7560011431138f9dac9f69aa047e1579638e29"
			, ["tests/helpers/nominal-subtype-npm-report.mjs"]]
		, ["66b441ecb8c3437a61796c9798c9935672bc4c52"
			, "dd9af401088a52e701c8cfa684a56c4a6f9be2df"
			, [".gitattributes", "tests/recursive-checked-record-wit.test.mjs"]]
		, ["e30a8577c8fbe7c4d29ed0157a032ba015843280"
			, "66b441ecb8c3437a61796c9798c9935672bc4c52"
			, ["scripts/run-test-profile.mjs"
				, "tests/helpers/core-quality-budget-tests.mjs"]]
		, ["bd9ebbf14f05a8750364255bf2416890b79d373e"
			, "e30a8577c8fbe7c4d29ed0157a032ba015843280"
			, [".gitattributes"
				, "tests/helpers/recursive-checked-record-rust-tests.mjs"]]
		, ["8e43e3210de3053867485f71929d0fe610f74966"
			, "ff1df8449a7f52fd8aee5203eae2493cf812cd2f"
			, [".gitattributes", "tests/recursive-checked-record-php.test.mjs"]]
	];
	assert.deepEqual(record.historicalTransitions.map(transition => [
		transition.commit, transition.predecessorCommit
		, transition.updates.map(update => update.path)
	]), expected);
	for(const transition of record.historicalTransitions)
	{
		assert.equal(git(["rev-parse", `${transition.commit}^`]).trim()
			, transition.predecessorCommit);
		for(const update of transition.updates)
		{
			const current = git(["show", `${transition.commit}:${update.path}`]);
			const previous = git(["show"
				, `${transition.predecessorCommit}:${update.path}`]);
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseCheckedJavaScriptDispositionUpdate(
				current, update), previous, update.path);
		}
	}
	assert.deepEqual([...new Set(record.historicalTransitions.flatMap(
		transition => transition.updates.map(update => update.path)
	))].sort(), checkedJavaScriptDispositionHistoricalPaths);
	let predecessorReachability = 0, transitionReachability = 0;
	for(const path of checkedJavaScriptDispositionHistoricalPaths)
	{
		const transitions = record.historicalTransitions.filter(transition =>
			transition.updates.some(update => update.path === path));
		const current = git(["show"
			, `${checkedJavaScriptDispositionPredecessor}:${path}`]);
		let direct = current;
		for(const transition of [...transitions].reverse())
		{
			const update = transition.updates.find(item => item.path === path);
			if(update.currentSha256 === sha256(direct)) direct = git(["show"
				, `${transition.predecessorCommit}:${path}`]);
		}
		assert.equal(beforeCheckedJavaScriptDispositionSource(path, current)
			, direct, path);
		for(const transition of transitions)
		{
			const update = transition.updates.find(item => item.path === path);
			const atTransition = git(["show"
				, `${transition.commit}:${path}`]);
			const expectedDigests = [update.currentSha256, update.previousSha256];
			for(const expectedSha256 of expectedDigests)
			{
				assert.equal(sha256(beforeFinRefinementSource(
					path, current, expectedSha256
				)), expectedSha256, `${path} ${expectedSha256} predecessor`);
				predecessorReachability++;
				assert.equal(sha256(beforeFinRefinementSource(
					path, atTransition, expectedSha256
				)), expectedSha256, `${path} ${expectedSha256} transition`);
				transitionReachability++;
			}
		}
	}
	assert.equal(predecessorReachability, 28);
	assert.equal(transitionReachability, 28);
});

test("history-hub reachability repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		historyHubReachabilityRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "history-hub-reachability-repair-source-v1");
	assert.equal(record.predecessorCommit
		, historyHubReachabilityRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, historyHubReachabilityRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, historyHubReachabilityRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		historyHubReachabilityRepairChangedPaths)));
	assert.equal(record.pinCount, 0);
	assert.deepEqual(record.pinUpdates, []);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeHistoryHubReachabilityRepairSource);
		const previous = git(["show"
			, `${historyHubReachabilityRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseHistoryHubReachabilityRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHistoryHubReachabilityRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeHistoryHubReachabilityRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeHistoryHubReachabilityRepairSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => {
				reverseHistoryHubReachabilityRepairUpdate(current, changed);
			});
		}
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${historyHubReachabilityRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("recursive native graph loader isolation has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		recursiveNativeGraphLoaderIsolationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "recursive-native-graph-loader-isolation-source-v1");
	assert.equal(record.predecessorCommit
		, recursiveNativeGraphLoaderIsolationPredecessor);
	assert.equal(record.draftParentCommit
		, recursiveNativeGraphLoaderIsolationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, recursiveNativeGraphLoaderIsolationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, recursiveNativeGraphLoaderIsolationAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		recursiveNativeGraphLoaderIsolationChangedPaths)));
	assert.equal(record.pinCount, 0);
	assert.deepEqual(record.pinUpdates, []);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeRecursiveNativeGraphLoaderIsolationSource);
		const previous = git(["show"
			, `${recursiveNativeGraphLoaderIsolationPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseRecursiveNativeGraphLoaderIsolationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeRecursiveNativeGraphLoaderIsolationSource(
			update.path, current), previous, update.path);
		assert.equal(beforeRecursiveNativeGraphLoaderIsolationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeRecursiveNativeGraphLoaderIsolationSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRecursiveNativeGraphLoaderIsolationUpdate(
				current, changed));
		}
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${recursiveNativeGraphLoaderIsolationPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("recursive native graph loader writer refuses another checkout", async t => {
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-recursive-native-graph-loader-writer-"
	));
	t.after(() => rm(directory, { recursive: true, force: true }));
	assert.equal(spawnSync("git", ["init", "-q"]
		, { cwd: directory }).status, 0);
	assert.equal(spawnSync("git", ["-c", "user.name=Test"
		, "-c", "user.email=test@example.invalid", "commit", "--allow-empty"
		, "-qm", "other"], { cwd: directory }).status, 0);
	const environment = Object.fromEntries(Object.entries(process.env).filter(
		([key]) => !key.startsWith("GIT_")
	));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-recursive-native-graph-loader-isolation-history.mjs"
	)], { cwd: directory, encoding: "utf8", env: environment });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual((await readdir(directory)).sort(), [".git"]);
});

test("recursive native graph verifier repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		recursiveNativeGraphVerifierRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "recursive-native-graph-verifier-repair-source-v1");
	assert.equal(record.predecessorCommit
		, recursiveNativeGraphVerifierRepairPredecessor);
	assert.equal(record.draftParentCommit
		, recursiveNativeGraphVerifierRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, recursiveNativeGraphVerifierRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, recursiveNativeGraphVerifierRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		recursiveNativeGraphVerifierRepairChangedPaths)));
	assert.equal(record.pinCount, 0);
	assert.deepEqual(record.pinUpdates, []);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeRecursiveNativeGraphVerifierRepairSource);
		const previous = git(["show"
			, `${recursiveNativeGraphVerifierRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseRecursiveNativeGraphVerifierRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeRecursiveNativeGraphVerifierRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeRecursiveNativeGraphVerifierRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeRecursiveNativeGraphVerifierRepairSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRecursiveNativeGraphVerifierRepairUpdate(
				current, changed));
		}
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${recursiveNativeGraphVerifierRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("recursive native graph verifier writer refuses another checkout", async t => {
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-recursive-native-graph-verifier-writer-"
	));
	t.after(() => rm(directory, { recursive: true, force: true }));
	assert.equal(spawnSync("git", ["init", "-q"]
		, { cwd: directory }).status, 0);
	assert.equal(spawnSync("git", ["-c", "user.name=Test"
		, "-c", "user.email=test@example.invalid", "commit", "--allow-empty"
		, "-qm", "other"], { cwd: directory }).status, 0);
	const environment = Object.fromEntries(Object.entries(process.env).filter(
		([key]) => !key.startsWith("GIT_")
	));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-recursive-native-graph-verifier-repair-history.mjs"
	)], { cwd: directory, encoding: "utf8", env: environment });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual((await readdir(directory)).sort(), [".git"]);
});

test("recursive native selector repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		recursiveNativeSelectorRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "recursive-native-selector-repair-source-v1");
	assert.equal(record.predecessorCommit
		, recursiveNativeSelectorRepairPredecessor);
	assert.equal(record.draftParentCommit
		, recursiveNativeSelectorRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, recursiveNativeSelectorRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, recursiveNativeSelectorRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		recursiveNativeSelectorRepairChangedPaths)));
	assert.equal(record.pinCount, 0);
	assert.deepEqual(record.pinUpdates, []);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeRecursiveNativeSelectorRepairSource);
		const previous = git(["show"
			, `${recursiveNativeSelectorRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseRecursiveNativeSelectorRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeRecursiveNativeSelectorRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeRecursiveNativeSelectorRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeRecursiveNativeSelectorRepairSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRecursiveNativeSelectorRepairUpdate(
				current, changed));
		}
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${recursiveNativeSelectorRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("recursive native selector repair writer refuses another checkout", async t => {
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-recursive-native-selector-writer-"
	));
	t.after(() => rm(directory, { recursive: true, force: true }));
	assert.equal(spawnSync("git", ["init", "-q"], { cwd: directory }).status, 0);
	assert.equal(spawnSync("git", ["-c", "user.name=Test"
		, "-c", "user.email=test@example.invalid", "commit", "--allow-empty"
		, "-qm", "other"], { cwd: directory }).status, 0);
	const environment = Object.fromEntries(Object.entries(process.env).filter(
		([key]) => !key.startsWith("GIT_")
	));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-recursive-native-selector-repair-history.mjs"
	)], { cwd: directory, encoding: "utf8", env: environment });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual((await readdir(directory)).sort(), [".git"]);
});

test("callback Fin gate repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		callbackFinGateRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-fin-gate-repair-source-v1");
	assert.equal(record.predecessorCommit, callbackFinGateRepairPredecessor);
	assert.equal(record.draftParentCommit, callbackFinGateRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, callbackFinGateRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackFinGateRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		callbackFinGateRepairChangedPaths)));
	assert.equal(record.pinCount, 45);
	assert.equal(record.pinUpdates.reduce((sum, item) => sum + item.count, 0)
		, record.pinCount);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackFinGateRepairSource);
		const previous = git(["show"
			, `${callbackFinGateRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCallbackFinGateRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCallbackFinGateRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCallbackFinGateRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeCallbackFinGateRepairSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCallbackFinGateRepairUpdate(
				current, changed));
		}
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${callbackFinGateRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("callback Fin gate repair writer refuses another checkout", async t => {
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-fin-gate-writer-"
	));
	t.after(() => rm(directory, { recursive: true, force: true }));
	assert.equal(spawnSync("git", ["init", "-q"], { cwd: directory }).status, 0);
	assert.equal(spawnSync("git", ["-c", "user.name=Test"
		, "-c", "user.email=test@example.invalid", "commit", "--allow-empty"
		, "-qm", "other"], { cwd: directory }).status, 0);
	const environment = Object.fromEntries(Object.entries(process.env).filter(
		([key]) => !key.startsWith("GIT_")
	));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-gate-repair-history.mjs"
	)], { cwd: directory, encoding: "utf8", env: environment });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual((await readdir(directory)).sort(), [".git"]);
});

test("downstream Fin CI repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		downstreamFinCiRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "downstream-fin-ci-repair-source-v1");
	assert.equal(record.predecessorCommit, downstreamFinCiRepairPredecessor);
	assert.equal(record.draftParentCommit, downstreamFinCiRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, downstreamFinCiRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, downstreamFinCiRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		downstreamFinCiRepairChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDownstreamFinCiRepairSource);
		const previous = git(["show"
			, `${downstreamFinCiRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseDownstreamFinCiRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDownstreamFinCiRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeDownstreamFinCiRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeDownstreamFinCiRepairSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reverseDownstreamFinCiRepairUpdate(
				current, changed));
		}
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${downstreamFinCiRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("downstream Fin CI repair restores the two missing attributes transitions", async () => {
	const record = JSON.parse(await readFile(
		downstreamFinCiRepairHistoryPath, "utf8"));
	assert.deepEqual(downstreamFinCiRepairHistoricalPaths, [".gitattributes"]);
	assert.deepEqual(record.historicalTransitions.map(transition =>
		transition.commit.slice(0, 7)
	), ["3546146", "41f0469"]);
	for(const transition of record.historicalTransitions)
	{
		assert.equal(git(["rev-parse", `${transition.commit}^`]).trim()
			, transition.predecessorCommit);
		for(const update of transition.updates)
		{
			const current = git(["show", `${transition.commit}:${update.path}`]);
			const previous = git(["show"
				, `${transition.predecessorCommit}:${update.path}`]);
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(sha256(beforeDownstreamFinCiRepairHistoricalSource(
				update.path, current, update.previousSha256
			)), update.previousSha256, update.path);
		}
	}
	const path = ".gitattributes";
	const live = await readFile(path, "utf8");
	const commits = git(["log", "--format=%H"
		, downstreamFinCiRepairPredecessor, "--", path])
		.trim().split("\n").filter(Boolean);
	assert.equal(commits.length, 21);
	const excluded = new Set(["a46d3db", "9baf9e6", "6de043f"]);
	let reached = 0;
	for(const commit of commits)
	{
		const expected = sha256(git(["show", `${commit}:${path}`]));
		const actual = sha256(beforeFinRefinementSource(path, live, expected));
		if(excluded.has(commit.slice(0, 7))) assert.notEqual(actual, expected);
		else
		{
			assert.equal(actual, expected, commit);
			reached++;
		}
	}
	assert.equal(reached, 18);
});

test("downstream Fin CI repair refreshes exact pins and names the two locally rerun observations", async () => {
	const record = JSON.parse(await readFile(
		downstreamFinCiRepairHistoryPath, "utf8"));
	assert.deepEqual(downstreamFinCiRepairRerunEvidence
		, ["npm-callback-fin-installed", "npm-nominal-fin-installed"]);
	assert.equal(record.pinCount, 141);
	assert.equal(record.pinCount, record.pinUpdates.reduce(
		(total, item) => total + item.count, 0));
	const inventoryUpdate = record.updates.find(update =>
		update.path === "docs/type-surface.v1.json");
	const source = await sourceAtFinHistoryMilestone(
		inventoryUpdate.path, inventoryUpdate.currentSha256
		, beforeDownstreamFinCiRepairSource);
	const current = JSON.parse(source);
	const previous = JSON.parse(beforeDownstreamFinCiRepairSource(
		inventoryUpdate.path, source));
	const pins = new Map(record.pinUpdates.map(item => [item.path, item]));
	const observed = new Map();
	let changed = 0;
	for(const [index, before] of previous.evidence.entries())
	{
		const after = current.evidence[index];
		assert.equal(after.id, before.id);
		assert.deepEqual({ ...after, files: undefined }
			, { ...before, files: undefined }, after.id);
		for(const [position, previousFile] of before.files.entries())
		{
			const currentFile = after.files[position];
			assert.equal(currentFile.path, previousFile.path, after.id);
			if(currentFile.sha256 === previousFile.sha256) continue;
			const pin = pins.get(currentFile.path);
			assert.equal(previousFile.sha256, pin.previousSha256);
			assert.equal(currentFile.sha256, pin.currentSha256);
			observed.set(currentFile.path
				, (observed.get(currentFile.path) ?? 0) + 1);
			changed++;
		}
	}
	assert.equal(changed, record.pinCount);
	for(const pin of record.pinUpdates)
		assert.equal(observed.get(pin.path), pin.count, pin.path);
	const priorPaths = new Set(downstreamFinCiRepairPriorPinRepairs.map(
		repair => repair.path
	));
	const repairedPins = record.pinUpdates.filter(pin =>
		priorPaths.has(pin.path));
	const expectedRepairs = downstreamFinCiRepairPriorPinRepairs.map(
		repair => ({ ...repair, count: 2 })
	);
	assert.deepEqual(repairedPins, expectedRepairs);
	for(const repair of downstreamFinCiRepairPriorPinRepairs)
	{
		const live = await readFile(repair.path, "utf8");
		assert.equal(sha256(live), repair.currentSha256);
		assert.equal(sha256(beforeFinRefinementSource(
			repair.path, live, repair.previousSha256
		)), repair.previousSha256);
	}
});

test("reviewed Fin browser readiness has a load-specific sixty-second budget", async () => {
	const source = await readFile("tests/helpers/type-corpus-browser.mjs", "utf8");
	assert.match(source, /const browserReadyTimeoutMs = 60_000;/u);
	assert.match(source, /\.waitFor\(\{ timeout: browserReadyTimeoutMs \}\)/u);
});

test("checked-JavaScript disposition additions are immutable", async () => {
	const record = JSON.parse(await readFile(
		checkedJavaScriptDispositionHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedJavaScriptDispositionPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("checked-JavaScript disposition refreshes only matching live pins", async () => {
	const record = JSON.parse(await readFile(
		checkedJavaScriptDispositionHistoryPath, "utf8"));
	assert.equal(record.pinCount, record.pinUpdates.reduce(
		(count, pin) => count + pin.count, 0));
	assert.equal(record.pinCount, 418);
	const inventoryUpdate = record.updates.find(update =>
		update.path === "docs/type-surface.v1.json");
	assert.ok(inventoryUpdate);
	const inventory = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryUpdate.path, inventoryUpdate.currentSha256
		, beforeCheckedJavaScriptDispositionSource));
	for(const update of record.pinUpdates)
	{
		const files = inventory.evidence.flatMap(entry => entry.files)
			.filter(file => file.path === update.path);
		assert.equal(files.filter(file => file.sha256
			=== update.currentSha256).length, update.count, update.path);
		assert.equal(files.filter(file => file.sha256
			=== update.previousSha256).length, 0, update.path);
	}
});

test("checked-JavaScript disposition writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-checked-javascript-disposition-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-checked-javascript-disposition-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("history-hub reachability writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-history-hub-reachability-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-history-hub-reachability-repair-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("downstream Fin CI repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-downstream-fin-ci-repair-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-downstream-fin-ci-repair-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("recursive diagnostics has exactly one explicit deferred disposition", async () => {
	const manifest = JSON.parse(await readFile(
		"config/checked-javascript.json", "utf8"));
	const path = "src/build/component-recursive-diagnostics.mjs";
	assert.ok(!manifest.checked.includes(path));
	assert.deepEqual(manifest.deferred.filter(entry => entry.path === path), [{
		path, classification: "strict-migration-backlog"
	}]);
});
