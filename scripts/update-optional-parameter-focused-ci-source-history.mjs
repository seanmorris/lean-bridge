#!/usr/bin/env node
/**
 * Record the focused optional-parameter producer and receipt workflow.
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

const predecessor = "05cc74823170285e65cb75ad053bd623189f1a6d";
const implementation = "f2fdf5bfcd51ebebaf522bf2fc10f1051735ffbe";
const historyPath
	= "docs/evidence/optional-parameter-focused-ci-source-history-20261029.json";
const inventoryPath = "docs/type-surface.v1.json";
const implementationPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/generic-subtype-languages.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, "scripts/reconcile-optional-parameter-matrix.mjs"
	, "tests/helpers/generic-subtype-npm-browser-ci-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt.mjs"
	, "tests/helpers/optional-parameter-matrix.mjs"
	, "tests/workflow-trigger-policy.test.mjs"
];
const implementationAdditions = [
	".github/workflows/optional-parameter-complete.yml"
];
const integrationPaths = ["config/checked-javascript.json", inventoryPath
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"];
const historyAdditions = [
	"scripts/update-optional-parameter-focused-ci-source-history.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history.mjs"
];
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-focused-ci-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), [...implementationAdditions].sort());
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
const addedImplementationSources = implementationAdditions.map(path => ({
	path, sha256: sha256(git(["show", `${implementation}:${path}`]))
}));

const inventory = JSON.parse(git(["show"
	, `${implementation}:${inventoryPath}`]));
const changedPaths = [...new Set([
	...implementationPaths, ...implementationAdditions
	, ...integrationPaths, ...historyAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.ok(currentSourcePaths.length > 0);
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, currentDigests);
assert.ok(reconciled.refreshed > 0);
await writeFile(inventoryPath
	, JSON.stringify(reconciled.inventory, null, 2) + "\n");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-parameter-focused-ci-"));
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
		, { input: "Authenticate focused optional-parameter CI\n" }
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
		, milestone: "optional-parameter-focused-ci-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Reuse five pinned recurring producers to execute all ten optional-parameter lanes and reconcile twenty canonical reports into one fail-closed 34-cell exact-head receipt. Bind receipt identity to the actual broad or focused workflow, preserve the broad path, restore trigger-policy coverage for three prior complete gates, add one manual and weekly focused caller, register all ten new default-value modules in the honest strict-migration backlog, and refresh only affected live-source identities without changing a support claim or hosted observation."
		, calledWorkflowCount: 5, producerJobCount: 13, receiptJobCount: 1
		, artifactCount: 10, reportCount: 20, profileCount: 17
		, routeCount: 2, cellCount: 34
		, recoveredTriggerPolicyWorkflows: 3
		, implementationAdditions: addedImplementationSources
		, updates, integrationUpdates
		, currentSourcePaths
		, currentSourceDigests: currentSourcePaths.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, refreshedPins: reconciled.refreshed
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and `
		+ `${reconciled.refreshed} live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
