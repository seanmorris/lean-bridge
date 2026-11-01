#!/usr/bin/env node
/**
 * Record the hosted PHP-Wasm Fin probe isolation repair.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	phpWasmFinHostedIsolationHistoryAdditions
	, phpWasmFinHostedIsolationHistoryPath
	, phpWasmFinHostedIsolationImplementation
	, phpWasmFinHostedIsolationImplementationPaths
	, phpWasmFinHostedIsolationIntegrationPaths
	, phpWasmFinHostedIsolationPredecessor
} from "../tests/helpers/php-wasm-fin-hosted-isolation-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-php-wasm-fin-hosted-isolation-source-history.mjs");
assert.equal(existsSync(phpWasmFinHostedIsolationHistoryPath), false
	, `${phpWasmFinHostedIsolationHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmFinHostedIsolationImplementation);
assert.equal(git(["rev-parse"
	, `${phpWasmFinHostedIsolationImplementation}^`]).trim(),
phpWasmFinHostedIsolationPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, phpWasmFinHostedIsolationPredecessor
	, phpWasmFinHostedIsolationImplementation, "--"]),
[...phpWasmFinHostedIsolationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, phpWasmFinHostedIsolationPredecessor
	, phpWasmFinHostedIsolationImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${phpWasmFinHostedIsolationImplementation}:${
		phpWasmFinHostedIsolationHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...phpWasmFinHostedIsolationIntegrationPaths]),
[...phpWasmFinHostedIsolationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmFinHostedIsolationHistoryAdditions]),
[...phpWasmFinHostedIsolationHistoryAdditions].sort());

const updates = [];
for(const path of phpWasmFinHostedIsolationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, phpWasmFinHostedIsolationPredecessor
		, phpWasmFinHostedIsolationImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-php-wasm-fin-isolation-"));
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
	temporaryGit(["read-tree", phpWasmFinHostedIsolationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...phpWasmFinHostedIsolationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", phpWasmFinHostedIsolationImplementation
	], { input: "Authenticate hosted PHP-Wasm Fin isolation\n" }).trim();
	const integrationUpdates = [];
	for(const path of phpWasmFinHostedIsolationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, phpWasmFinHostedIsolationImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of phpWasmFinHostedIsolationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(phpWasmFinHostedIsolationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "php-wasm-fin-hosted-isolation-source-v1"
		, predecessorCommit: phpWasmFinHostedIsolationPredecessor
		, implementationCommit: phpWasmFinHostedIsolationImplementation
		, candidate: {
			commit: "766fd12a6297fe52fe3eeccc77105aacb2f32903"
			, downstreamRunId: 41242839565
			, cFamilyJobId: 124679799163
			, phpWasmRefinementJobId: 124679799405
			, phpWasmRefinementFailedTests: 43
		}
		, validation: {
			selectionProbeTests: 1, selectionProbeSkipped: 1
			, selectionProbeDurationMs: 1445
			, priorHostedStepDurationSeconds: 6759
			, runtimeSemanticChanges: 0
		}
		, changedSupportCells: 0, sourceContractChanges: 2
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and both diagnostic jobs.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
