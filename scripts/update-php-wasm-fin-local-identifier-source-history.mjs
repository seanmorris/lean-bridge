#!/usr/bin/env node
/**
 * Record the PHP-Wasm Fin generated-C local identifier repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertPhpWasmFinLocalIdentifierRepair
	, phpWasmFinLocalIdentifierBehavior as behavior
	, phpWasmFinLocalIdentifierHistoryAdditions as historyAdditions
	, phpWasmFinLocalIdentifierHistoryPath as historyPath
	, phpWasmFinLocalIdentifierImplementation as implementation
	, phpWasmFinLocalIdentifierImplementationPaths as implementationPaths
	, phpWasmFinLocalIdentifierIntegrationPaths as integrationPaths
	, phpWasmFinLocalIdentifierPredecessor as predecessor
} from "../tests/helpers/php-wasm-fin-local-identifier-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-php-wasm-fin-local-identifier-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation
	, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const implementationSources = Object.fromEntries(implementationPaths.map(
	path => [path, blob(implementation, path)]));
assert.deepEqual(assertPhpWasmFinLocalIdentifierRepair(implementationSources)
	, { ...behavior });

const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);
const exactModel = {
	sha256: sha256(exactSources[0])
	, bytes: Buffer.byteLength(exactSources[0])
	, cells: exact.model.length, stageEntries: exact.stageEntries
};
assert.deepEqual(exactModel, {
	sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
	, bytes: 16916757, cells: 1054, stageEntries: 5270
});

// The repaired test carries no inventory pin, so no live pin may move.
const inventories = [predecessor, implementation].map(commit =>
	blob(commit, inventoryPath));
const workingInventory = await readFile(inventoryPath, "utf8");
assert.equal(sha256(inventories[0]), sha256(inventories[1]));
assert.equal(sha256(workingInventory), sha256(inventories[1]));
for(const path of implementationPaths)
	for(const commit of [predecessor, implementation])
		assert.equal(inventories[1].includes(sha256(blob(commit, path)))
			, false, `${commit}:${path}`);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir()
	, "lean-php-wasm-fin-local-identifier-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
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
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate PHP-Wasm Fin local identifier repair\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "php-wasm-fin-local-identifier-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			candidate: "c2eca28ce3957c14e66364767bac90656ec5074e"
			, referenceImplementation: "a2b43c970e6ac48d40b8682a22d68022563c8e79"
			, coreRun: 42248050647
			, profile: "contract"
			, test: "the PHP-Wasm side module compares caller limbs with each bound before the only conversion into Lean"
			, location: "tests/php-wasm-fin.test.mjs:157-158"
			, localReproduction: { tests: 1, pass: 0, fail: 1 }
		}
		, rootCause: "The PHP-Wasm side-module ordering assertion still searched for the pre-prefix generated locals `lean_object *checked = ` and `_check(arg0, &budget)`. generateNativePrimitiveC has emitted `_lb_checked` and `_lb_budget` since 443596f, so both indexOf calls returned -1 and the ordering assertion failed in the Core contract profile, where php-wasm-fin runs ungated."
		, repair: "Search for the current generated locals `lean_object *_lb_checked = ` and `_check(arg0, &_lb_budget)`, the same contract tests/native-fin-product-arrays.test.mjs already asserts, and keep the budget-check, inner-limb, tag and dispatch ordering check unchanged."
		, behavior
		, exactModel
		, inventorySha256: {
			before: sha256(inventories[0]), after: sha256(inventories[1])
		}
		, refreshed: {}, changedSupportCells: 0, runtimeSemanticChanges: 0
		, validation: {
			focused: { tests: 1, pass: 1, fail: 0 }
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions; `
		+ "no live pin moved.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
