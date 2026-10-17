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
	beforeCheckedJavaScriptDispositionSource
	, checkedJavaScriptDispositionAddedPaths
	, checkedJavaScriptDispositionCurrentChangedPaths
	, checkedJavaScriptDispositionHistoryPath
	, checkedJavaScriptDispositionHistoricalPaths
	, checkedJavaScriptDispositionPredecessor
	, reverseCheckedJavaScriptDispositionUpdate
} from "./checked-javascript-disposition-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

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
		const current = await readFile(update.path, "utf8");
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
			for(const expectedSha256 of [update.currentSha256
				, update.previousSha256])
				assert.equal(sha256(beforeFinRefinementSource(
					path, current, expectedSha256
				)), expectedSha256, `${path} ${expectedSha256}`);
		}
	}
});

test("checked-JavaScript disposition additions are immutable", async () => {
	const record = JSON.parse(await readFile(
		checkedJavaScriptDispositionHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
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
	const inventory = JSON.parse(await readFile(
		"docs/type-surface.v1.json", "utf8"));
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

test("recursive diagnostics has exactly one explicit deferred disposition", async () => {
	const manifest = JSON.parse(await readFile(
		"config/checked-javascript.json", "utf8"));
	const path = "src/build/component-recursive-diagnostics.mjs";
	assert.ok(!manifest.checked.includes(path));
	assert.deepEqual(manifest.deferred.filter(entry => entry.path === path), [{
		path, classification: "strict-migration-backlog"
	}]);
});
