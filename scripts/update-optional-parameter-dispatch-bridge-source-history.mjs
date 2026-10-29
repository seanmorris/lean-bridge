#!/usr/bin/env node
/**
 * Record the registered manual-dispatch bridge for focused optional CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const predecessor = "06a6b53ab1669724500896e23df2c6a963d76261";
const implementation = "508900c0b79d586c4a364efe9020a51704ff7cde";
const historyPath
	= "docs/evidence/optional-parameter-dispatch-bridge-source-history-20261029.json";
const inventoryPath = "docs/type-surface.v1.json";
const implementationPaths = [
	".github/workflows/dependent-checked-record-matrix.yml"
	, ".github/workflows/optional-parameter-complete.yml"
	, "tests/helpers/dependent-checked-record-matrix-ci-tests.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
];
const integrationPaths = ["tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history-tests.mjs"];
const historyAdditions = [
	"scripts/update-optional-parameter-dispatch-bridge-source-history.mjs"
	, "tests/helpers/optional-parameter-dispatch-bridge-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-dispatch-bridge-source-history.mjs"
];
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-dispatch-bridge-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation, { maximumEditBytes: 32 * 1024 * 1024 }
	));

const inventory = JSON.parse(git(["show"
	, `${implementation}:${inventoryPath}`]));
const changedPaths = [...new Set([
	...implementationPaths, ...integrationPaths, ...historyAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = currentDigests.size === 0
	? { inventory, refreshed: 0 }
	: reconcileDependentCheckedRecordSourcePins(inventory, currentDigests);
assert.equal(reconciled.refreshed, 0);
assert.deepEqual(reconciled.inventory, inventory);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-parameter-dispatch-bridge-"));
try
{
	const temporaryIndex = join(directory, "index");
	const environment = {
		...process.env, GIT_INDEX_FILE: temporaryIndex
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", implementation]
		, { input: "Authenticate optional-parameter dispatch bridge\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only", implementation, "--", path])
			.trim(), "", path);
		additions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "optional-parameter-dispatch-bridge-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Make the new focused optional-parameter workflow reusable and expose it through one already registered, manually selected matrix dispatcher without changing automatic triggers or the default dependent checked-record audit. Preserve the exact same-run 34-cell receipt contract, reject bridge bypasses, confirm that dispatch-only sources own no promoted type-surface pins, and make no support claim before hosted acceptance."
		, implementationPaths, updates, integrationUpdates
		, currentSourcePaths
		, currentSourceDigests: currentSourcePaths.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, refreshedPins: reconciled.refreshed
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} dispatch transitions, `
		+ `${integrationUpdates.length} registrations and `
		+ `${reconciled.refreshed} live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
