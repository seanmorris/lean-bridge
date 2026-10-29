#!/usr/bin/env node
/**
 * Record the optional-parameter receipt sparse-checkout repair.
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
	optionalParameterReceiptSparseCheckoutHistoryAdditions
	, optionalParameterReceiptSparseCheckoutHistoryPath
	, optionalParameterReceiptSparseCheckoutImplementation
	, optionalParameterReceiptSparseCheckoutImplementationPaths
	, optionalParameterReceiptSparseCheckoutIntegrationPaths
	, optionalParameterReceiptSparseCheckoutPredecessor
} from "../tests/helpers/optional-parameter-receipt-sparse-checkout-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterReceiptSparseCheckoutImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterReceiptSparseCheckoutImplementation}^`]).trim()
, optionalParameterReceiptSparseCheckoutPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterReceiptSparseCheckoutPredecessor
	, optionalParameterReceiptSparseCheckoutImplementation, "--"])
, [...optionalParameterReceiptSparseCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterReceiptSparseCheckoutPredecessor
	, optionalParameterReceiptSparseCheckoutImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterReceiptSparseCheckoutImplementation}`
		+ `:${optionalParameterReceiptSparseCheckoutHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.equal(existsSync(optionalParameterReceiptSparseCheckoutHistoryPath), false
	, `${optionalParameterReceiptSparseCheckoutHistoryPath} already exists`);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterReceiptSparseCheckoutIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterReceiptSparseCheckoutHistoryAdditions])
, [...optionalParameterReceiptSparseCheckoutHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterReceiptSparseCheckoutImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterReceiptSparseCheckoutPredecessor
		, optionalParameterReceiptSparseCheckoutImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const changedPaths = [...new Set([
	...optionalParameterReceiptSparseCheckoutImplementationPaths
	, ...optionalParameterReceiptSparseCheckoutIntegrationPaths
	, ...optionalParameterReceiptSparseCheckoutHistoryAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths, []);

const directory = await mkdtemp(join(tmpdir(), "lean-optional-receipt-sparse-"));
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
	temporaryGit(["read-tree", optionalParameterReceiptSparseCheckoutImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterReceiptSparseCheckoutIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree"
		, tree
		, "-p"
		, optionalParameterReceiptSparseCheckoutImplementation
	], { input: "Authenticate optional receipt sparse checkout\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterReceiptSparseCheckoutIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterReceiptSparseCheckoutImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of optionalParameterReceiptSparseCheckoutHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterReceiptSparseCheckoutImplementation, "--", path])
			.trim(), "", path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterReceiptSparseCheckoutHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-receipt-sparse-checkout-source-v1"
			, predecessorCommit: optionalParameterReceiptSparseCheckoutPredecessor
			, implementationCommit: optionalParameterReceiptSparseCheckoutImplementation
			, scope: "Keep the exact same-run optional-parameter receipt off the 43 GiB immutable evidence corpus. Check out the complete current source tree except docs/evidence at depth one; preserve all producer needs, artifact identities, reconciliation inputs, fail-closed enforcement and archive semantics."
			, excludedTree: "docs/evidence", updates, integrationUpdates
			, historyAdditions, currentSourcePaths, refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
