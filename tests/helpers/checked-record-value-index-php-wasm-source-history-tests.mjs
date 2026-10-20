/**
 * Verify the delayed PHP-Wasm value-index lineage against exact Git objects.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexPhpWasmSource
	, checkedRecordValueIndexPhpWasmChangedPaths
	, checkedRecordValueIndexPhpWasmHistoryAddedPaths
	, checkedRecordValueIndexPhpWasmHistoryPath
	, checkedRecordValueIndexPhpWasmRegistrationParent
	, checkedRecordValueIndexPhpWasmRegistrationPaths
	, checkedRecordValueIndexPhpWasmTransitions
	, reverseCheckedRecordValueIndexPhpWasmUpdate
} from "./checked-record-value-index-php-wasm-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

test("PHP-Wasm value-index work has one authenticated delayed lineage", async () => {
	const ledger = JSON.parse(await readFile(
		checkedRecordValueIndexPhpWasmHistoryPath, "utf8"
	));
	assert.equal(ledger.schemaVersion, 1);
	assert.equal(ledger.milestone
		, "checked-record-value-index-php-wasm-source-v1");
	assert.equal(ledger.registrationParent
		, checkedRecordValueIndexPhpWasmRegistrationParent);
	assert.deepEqual(ledger.transitions, checkedRecordValueIndexPhpWasmTransitions
		.map(({ name, previousCommit, currentCommit
			, modifiedPaths, addedPaths }) => ({
			name, previousCommit, currentCommit, modifiedPaths, addedPaths})
		)
	);
	assert.deepEqual(ledger.registrationPaths
		, checkedRecordValueIndexPhpWasmRegistrationPaths);
	assert.deepEqual(ledger.additions.map(item => item.path)
		, checkedRecordValueIndexPhpWasmHistoryAddedPaths);
	assert.equal(ledger.pathsSha256
		, sha256(JSON.stringify(checkedRecordValueIndexPhpWasmChangedPaths)));
	for(const update of ledger.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexPhpWasmSource
		);
		const previous = git(["show", `${update.previousCommit}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexPhpWasmUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexPhpWasmSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const transition of checkedRecordValueIndexPhpWasmTransitions)
	{
		assert.equal(git(["rev-parse", `${transition.currentCommit}^`]).trim()
			, transition.previousCommit, transition.name);
		assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
			, transition.previousCommit, transition.currentCommit])
			, [...transition.modifiedPaths].sort(), transition.name);
		assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
			, transition.previousCommit, transition.currentCommit])
			, [...transition.addedPaths].sort(), transition.name);
		for(const path of transition.addedPaths)
		{
			const addition = ledger.historicalAdditions.find(item =>
				item.transition === transition.name && item.path === path
			);
			assert.ok(addition, `${transition.name}:${path}`);
			assert.equal(sha256(git(["show", `${transition.currentCommit}:${path}`]))
				, addition.currentSha256, path);
		}
	}
	for(const addition of ledger.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexPhpWasmRegistrationParent}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("PHP-Wasm value-index history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-history-"));
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
		"scripts/update-checked-record-value-index-php-wasm-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact registration parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
