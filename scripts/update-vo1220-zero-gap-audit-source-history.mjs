#!/usr/bin/env node
/**
 * Record the final VO #1220 zero-gap audit contract.
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
	vo1220ZeroGapAuditHistoryAdditions, vo1220ZeroGapAuditHistoryPath
	, vo1220ZeroGapAuditImplementation, vo1220ZeroGapAuditImplementationAdditions
	, vo1220ZeroGapAuditImplementationPaths, vo1220ZeroGapAuditIntegrationPaths
	, vo1220ZeroGapAuditPredecessor
} from "../tests/helpers/vo1220-zero-gap-audit-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-zero-gap-audit-source-history.mjs");
assert.equal(existsSync(vo1220ZeroGapAuditHistoryPath), false
	, `${vo1220ZeroGapAuditHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim(), vo1220ZeroGapAuditImplementation);
assert.equal(git(["rev-parse", `${vo1220ZeroGapAuditImplementation}^`]).trim()
	, vo1220ZeroGapAuditPredecessor);
assert.deepEqual(
	names(["diff", "--name-only", "--diff-filter=M"
		, vo1220ZeroGapAuditPredecessor, vo1220ZeroGapAuditImplementation, "--"])
	, [...vo1220ZeroGapAuditImplementationPaths].sort()
);
assert.deepEqual(
	names(["diff", "--name-only", "--diff-filter=A"
		, vo1220ZeroGapAuditPredecessor, vo1220ZeroGapAuditImplementation, "--"])
	, [...vo1220ZeroGapAuditImplementationAdditions].sort()
);
assert.notEqual(
	spawnSync("git", ["cat-file", "-e"
		, `${vo1220ZeroGapAuditImplementation}:${vo1220ZeroGapAuditHistoryPath}`]
	, { stdio: "ignore" }).status, 0
);
assert.deepEqual(
	names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--", ...vo1220ZeroGapAuditIntegrationPaths])
	, [...vo1220ZeroGapAuditIntegrationPaths].sort()
);
assert.deepEqual(
	names(["ls-files", "--others", "--exclude-standard", "--"
		, ...vo1220ZeroGapAuditHistoryAdditions])
	, [...vo1220ZeroGapAuditHistoryAdditions].sort()
);

const updates = [];
for(const path of vo1220ZeroGapAuditImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ZeroGapAuditPredecessor, vo1220ZeroGapAuditImplementation));
const implementationAdditions = vo1220ZeroGapAuditImplementationAdditions
	.map(path => ({
		path
		, sha256: sha256(git(["show"
			, `${vo1220ZeroGapAuditImplementation}:${path}`]))
	}));

const directory = await mkdtemp(join(tmpdir(), "lean-vo1220-zero-gap-audit-"));
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
			encoding: "utf8", maxBuffer: 64 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", vo1220ZeroGapAuditImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ZeroGapAuditIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", vo1220ZeroGapAuditImplementation
	], { input: "Authenticate final 1220 zero-gap audit\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ZeroGapAuditIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, vo1220ZeroGapAuditImplementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of vo1220ZeroGapAuditHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ZeroGapAuditHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "vo1220-zero-gap-audit-source-v1"
		, predecessorCommit: vo1220ZeroGapAuditPredecessor
		, implementationCommit: vo1220ZeroGapAuditImplementation
		, scope: "Define the final owner-based VO #1220 closure contract against the live Binding IR and consumer schemas. Require the original ten shapes, exactly 1,054 cells and 5,270 passing stage entries, explicit observations and host types, installed evidence and zero exclusions. Exercise the complete proposed state and refuse a non-passing stage, inferred profile coverage, owner drift and unclassified IR. This establishes the audit contract but does not claim current closure before HostNull promotion and final hosted/Core identities."
		, updates, implementationAdditions, integrationUpdates, historyAdditions
		, owner: 1220, cells: 1054, stageEntries: 5270
		, currentPassedCells: 884, currentGapEntries: 850
		, remainingShape: "host-null", remainingCells: 170
		, closesCurrentInventory: false
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} audit transition, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
