#!/usr/bin/env node
/**
 * Record the optional-parameter native evidence correction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { dependentCheckedRecordPromotionCurrentSourcePaths }
	from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	optionalParameterNativeEvidenceRepairHistoryAdditions
	, optionalParameterNativeEvidenceRepairHistoryPath
	, optionalParameterNativeEvidenceRepairImplementation
	, optionalParameterNativeEvidenceRepairImplementationPaths
	, optionalParameterNativeEvidenceRepairIntegrationPaths
	, optionalParameterNativeEvidenceRepairPredecessor
} from "../tests/helpers/optional-parameter-native-evidence-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-native-evidence-repair-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterNativeEvidenceRepairImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterNativeEvidenceRepairImplementation}^`]).trim()
, optionalParameterNativeEvidenceRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterNativeEvidenceRepairPredecessor
	, optionalParameterNativeEvidenceRepairImplementation, "--"])
, [...optionalParameterNativeEvidenceRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterNativeEvidenceRepairPredecessor
	, optionalParameterNativeEvidenceRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterNativeEvidenceRepairImplementation}:${optionalParameterNativeEvidenceRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterNativeEvidenceRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterNativeEvidenceRepairHistoryAdditions])
, [...optionalParameterNativeEvidenceRepairHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterNativeEvidenceRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterNativeEvidenceRepairPredecessor
		, optionalParameterNativeEvidenceRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const inventory = JSON.parse(git(["show"
	, `${optionalParameterNativeEvidenceRepairImplementation}:${inventoryPath}`]));
const changedPaths = [...new Set([
	...optionalParameterNativeEvidenceRepairImplementationPaths
	, ...optionalParameterNativeEvidenceRepairIntegrationPaths
	, ...optionalParameterNativeEvidenceRepairHistoryAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths, []);

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-native-evidence-repair-"));
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
	temporaryGit(["read-tree", optionalParameterNativeEvidenceRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterNativeEvidenceRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", optionalParameterNativeEvidenceRepairImplementation
	], { input: "Authenticate optional native evidence repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterNativeEvidenceRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterNativeEvidenceRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const additions = [];
	for(const path of optionalParameterNativeEvidenceRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterNativeEvidenceRepairImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterNativeEvidenceRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-native-evidence-repair-source-v1"
			, predecessorCommit: optionalParameterNativeEvidenceRepairPredecessor
			, implementationCommit: optionalParameterNativeEvidenceRepairImplementation
			, scope: "Replace the impossible wasm bundle assumption in every non-npm optional-parameter lane with the authenticated compiler profile each prepared package actually consumes. Native language, managed, C/C++ and WIT lanes retain closed native-component records; the combined PHP lane retains and independently checks both native and PHP-Wasm component records. Preserve ordinary arg0 and reviewed value0 binder identities without weakening exact default, type, receipt, adapter or artifact authentication."
			, repairedLaneGroups: 5, profileCount: 12
			, updates, integrationUpdates, currentSourcePaths
			, refreshedPins: 0, historyAdditions: additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
