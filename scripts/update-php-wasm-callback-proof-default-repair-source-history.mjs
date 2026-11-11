#!/usr/bin/env node
/**
 * Record the proof-preserving callback recovery repair exposed by the final
 * PHP-Wasm activation for plan node 1220.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	phpWasmCallbackProofDefaultRepairBehavior as behavior
	, phpWasmCallbackProofDefaultRepairHistoryAdditions as historyAdditions
	, phpWasmCallbackProofDefaultRepairHistoryPath as historyPath
	, phpWasmCallbackProofDefaultRepairImplementation as implementation
	, phpWasmCallbackProofDefaultRepairImplementationPaths as implementationPaths
	, phpWasmCallbackProofDefaultRepairIntegrationPaths as integrationPaths
	, phpWasmCallbackProofDefaultRepairPredecessor as predecessor
} from "../tests/helpers/php-wasm-callback-proof-default-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Callback proof-default history requires its exact implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const transitions = new Map();
for(const path of implementationPaths)
	transitions.set(path, {
		previous: sha256(blob(predecessor, path))
		, current: sha256(blob(implementation, path))
	});
const inventory = JSON.parse(blob(implementation, inventoryPath));
const pointerUpdates = [];
for(const evidence of inventory.evidence)
	for(const file of evidence.files)
	{
		const transition = transitions.get(file.path);
		if(!transition || file.sha256 !== transition.previous) continue;
		file.sha256 = transition.current;
		pointerUpdates.push({ path: file.path, ...transition });
	}
assert.ok(pointerUpdates.length > 0
	, "Callback proof-default sources require live type-surface pins");
await writeFile(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");

assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-callback-proof-default-"));
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
	], { input: "Authenticate callback proof-default repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({
			path, sha256: sha256(await readFile(path))
		});
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "php-wasm-callback-proof-default-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, rootCause: "Eager finite callback recovery recipes constructed proof-erased checked records as source values, requiring proof fields that are deliberately absent from the transport payload."
		, repair: "Compute the transitive recovery dependency closure rooted at proof-erased records, render only that closure through authenticated payload mirrors, omit unreachable unsafe recipes and reject any actual fallback without a proof-preserving source value."
		, behavior, refreshedTypeSurfacePointers: pointerUpdates.length
		, pointerUpdates
		, validation: {
			focusedGeneratorContracts: "24/24 passed"
			, checkedRecordRegression: "passed"
			, exactLeanAdapterReproduction: "passed"
			, scopedLint: "passed", diffCheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} integration transitions, `
		+ `${historyAdditionRecords.length} additions and `
		+ `${pointerUpdates.length} refreshed pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
