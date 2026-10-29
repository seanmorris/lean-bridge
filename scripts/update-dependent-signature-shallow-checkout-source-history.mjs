#!/usr/bin/env node
/**
 * Record the focused dependent-signature shallow-checkout transition.
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
	dependentCheckedRecordPromotionCurrentSourcePaths
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	dependentSignatureShallowCheckoutHistoryAdditions
	, dependentSignatureShallowCheckoutHistoryPath
	, dependentSignatureShallowCheckoutImplementation
	, dependentSignatureShallowCheckoutImplementationPaths
	, dependentSignatureShallowCheckoutIntegrationPaths
	, dependentSignatureShallowCheckoutPredecessor
} from "../tests/helpers/dependent-signature-shallow-checkout-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-signature-shallow-checkout-source-history.mjs");
assert.equal(existsSync(dependentSignatureShallowCheckoutHistoryPath), false
	, `${dependentSignatureShallowCheckoutHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentSignatureShallowCheckoutImplementation);
assert.equal(git(["rev-parse"
	, `${dependentSignatureShallowCheckoutImplementation}^`]).trim()
, dependentSignatureShallowCheckoutPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentSignatureShallowCheckoutPredecessor
	, dependentSignatureShallowCheckoutImplementation, "--"])
, [...dependentSignatureShallowCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentSignatureShallowCheckoutPredecessor
	, dependentSignatureShallowCheckoutImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentSignatureShallowCheckoutImplementation}`
		+ `:${dependentSignatureShallowCheckoutHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...dependentSignatureShallowCheckoutIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentSignatureShallowCheckoutHistoryAdditions])
, [...dependentSignatureShallowCheckoutHistoryAdditions].sort());

const updates = [];
for(const path of dependentSignatureShallowCheckoutImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, dependentSignatureShallowCheckoutPredecessor
		, dependentSignatureShallowCheckoutImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const changedPaths = [...new Set([
	...dependentSignatureShallowCheckoutImplementationPaths
	, ...dependentSignatureShallowCheckoutIntegrationPaths
	, ...dependentSignatureShallowCheckoutHistoryAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths, []);

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-signature-shallow-checkout-"));
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
			encoding: "utf8", maxBuffer: 256 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", dependentSignatureShallowCheckoutImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...dependentSignatureShallowCheckoutIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", dependentSignatureShallowCheckoutImplementation
	], { input: "Authenticate focused shallow checkouts\n" }).trim();
	const integrationUpdates = [];
	for(const path of dependentSignatureShallowCheckoutIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, dependentSignatureShallowCheckoutImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of dependentSignatureShallowCheckoutHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentSignatureShallowCheckoutImplementation, "--", path])
			.trim(), "", path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(dependentSignatureShallowCheckoutHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-signature-shallow-checkout-source-v1"
			, predecessorCommit: dependentSignatureShallowCheckoutPredecessor
			, implementationCommit: dependentSignatureShallowCheckoutImplementation
			, scope: "Keep standalone, manual and scheduled dependent checked-record workflows on complete source history while using exact depth-one checkouts for the eleven focused dependent-signature package producers. Preserve one complete-history archive and promotion audit, exact producer identities, fail-closed same-run receipt reconciliation and every existing runtime contract."
			, producerWorkflowCount: 11, fullHistoryAuditCount: 1
			, updates, integrationUpdates, historyAdditions
			, currentSourcePaths, refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
