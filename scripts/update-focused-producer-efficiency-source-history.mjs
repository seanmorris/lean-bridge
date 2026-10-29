#!/usr/bin/env node
/**
 * Record the focused producer checkout and workload optimization.
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
	focusedProducerEfficiencyHistoryAdditions
	, focusedProducerEfficiencyHistoryPath
	, focusedProducerEfficiencyImplementation
	, focusedProducerEfficiencyImplementationPaths
	, focusedProducerEfficiencyIntegrationPaths
	, focusedProducerEfficiencyPredecessor
} from "../tests/helpers/focused-producer-efficiency-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-focused-producer-efficiency-source-history.mjs");
assert.equal(existsSync(focusedProducerEfficiencyHistoryPath), false
	, "Focused producer efficiency history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, focusedProducerEfficiencyImplementation);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, focusedProducerEfficiencyPredecessor
	, focusedProducerEfficiencyImplementation, "--"])
, [...focusedProducerEfficiencyImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, focusedProducerEfficiencyPredecessor
	, focusedProducerEfficiencyImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${focusedProducerEfficiencyImplementation}:`
		+ focusedProducerEfficiencyHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...focusedProducerEfficiencyIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...focusedProducerEfficiencyHistoryAdditions])
, [...focusedProducerEfficiencyHistoryAdditions].sort());

const updates = [];
for(const path of focusedProducerEfficiencyImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, focusedProducerEfficiencyPredecessor
		, focusedProducerEfficiencyImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(tmpdir()
	, "lean-focused-producer-efficiency-"));
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
		"git", arguments_, { encoding: "utf8"
			, maxBuffer: 256 * 1024 * 1024, env: environment, ...options });
	temporaryGit(["read-tree", focusedProducerEfficiencyImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...focusedProducerEfficiencyIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, focusedProducerEfficiencyImplementation]
	, { input: "Authenticate focused producer efficiency\n" }).trim();
	const integrationUpdates = [];
	for(const path of focusedProducerEfficiencyIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, focusedProducerEfficiencyImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of focusedProducerEfficiencyHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, focusedProducerEfficiencyImplementation, "--", path]).trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(focusedProducerEfficiencyHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "focused-producer-efficiency-source-v1"
		, predecessorCommit: focusedProducerEfficiencyPredecessor
		, implementationCommit: focusedProducerEfficiencyImplementation
		, scope: "Keep default generic-Subtype producers unchanged while focused optional-parameter, proof-erasure, and HostNull dispatches use depth-one checkouts, omit unrelated base acceptance and artifacts, skip unrelated jobs, and select only the reviewed browser route. Preserve exact fail-closed focused receipts and recurring default behavior."
		, updates, integrationUpdates, implementationAdditions: []
		, historyAdditions, currentSourcePaths: [], refreshedPins: 0
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
