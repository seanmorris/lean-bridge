#!/usr/bin/env node
/**
 * Record the bounded HostNull promotion source-pin reconciliation.
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
	hostNullPromotionPinReconciliationHistoryAdditions
	, hostNullPromotionPinReconciliationHistoryPath
	, hostNullPromotionPinReconciliationImplementation
	, hostNullPromotionPinReconciliationImplementationAdditions
	, hostNullPromotionPinReconciliationImplementationPaths
	, hostNullPromotionPinReconciliationIntegrationPaths
	, hostNullPromotionPinReconciliationPredecessor
} from "../tests/helpers/host-null-promotion-pin-reconciliation-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-promotion-pin-reconciliation-source-history.mjs");
assert.equal(existsSync(hostNullPromotionPinReconciliationHistoryPath), false
	, `${hostNullPromotionPinReconciliationHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullPromotionPinReconciliationImplementation);
assert.equal(git(["rev-parse"
	, `${hostNullPromotionPinReconciliationImplementation}^`]).trim()
, hostNullPromotionPinReconciliationPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, hostNullPromotionPinReconciliationPredecessor
	, hostNullPromotionPinReconciliationImplementation, "--"])
, [...hostNullPromotionPinReconciliationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullPromotionPinReconciliationPredecessor
	, hostNullPromotionPinReconciliationImplementation, "--"])
, [...hostNullPromotionPinReconciliationImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${hostNullPromotionPinReconciliationImplementation}`
		+ `:${hostNullPromotionPinReconciliationHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...hostNullPromotionPinReconciliationIntegrationPaths])
, [...hostNullPromotionPinReconciliationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullPromotionPinReconciliationHistoryAdditions])
, [...hostNullPromotionPinReconciliationHistoryAdditions].sort());

const updates = [];
for(const path of hostNullPromotionPinReconciliationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, hostNullPromotionPinReconciliationPredecessor
		, hostNullPromotionPinReconciliationImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));
const implementationAdditions = [];
for(const path of hostNullPromotionPinReconciliationImplementationAdditions)
	implementationAdditions.push({
		path
		, sha256: sha256(git(["show"
			, `${hostNullPromotionPinReconciliationImplementation}:${path}`]))
	});

const directory = await mkdtemp(join(
	tmpdir(), "lean-host-null-promotion-pin-reconciliation-"));
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
	temporaryGit(["read-tree", hostNullPromotionPinReconciliationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullPromotionPinReconciliationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, hostNullPromotionPinReconciliationImplementation
	], { input: "Authenticate HostNull promotion pin reconciliation\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullPromotionPinReconciliationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullPromotionPinReconciliationImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of hostNullPromotionPinReconciliationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(hostNullPromotionPinReconciliationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "host-null-promotion-pin-reconciliation-source-v1"
			, predecessorCommit: hostNullPromotionPinReconciliationPredecessor
			, implementationCommit: hostNullPromotionPinReconciliationImplementation
			, scope: "Repair complete HostNull publication before consuming hosted evidence. Preserve the already-current five-entry Perl repair, advance exactly 131 stale generate-type-docs pins across 132 retained evidence entries, reject unknown intermediate digests, and stage the bounded refresh transactionally before adding the 170-cell HostNull evidence. No generator behavior, runtime contract, support observation, archive byte or public claim changes."
			, updates, implementationAdditions, integrationUpdates
			, historyAdditions, typeDocsEvidence: 132
			, typeDocsStalePins: 131, supportClaimsChanged: false
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} source-pin repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
