#!/usr/bin/env node
/**
 * Record the bounded direct proof-erasure producer and exact-run receipt.
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

const predecessor = "faa88f5d030d8a377dcc30c8807d0d62b60533be";
const implementation = "0af32f5861db9f4d3621b2a69beef03b9352fcb5";
const historyPath
	= "docs/evidence/direct-proof-erasure-focused-ci-source-history-20261029.json";
const inventoryPath = "docs/type-surface.v1.json";
const implementationPaths = [
	".github/workflows/direct-proof-erasure-complete.yml"
	, ".github/workflows/generic-subtype-languages.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, ".github/workflows/optional-parameter-complete.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/direct-proof-erasure-complete-ci-tests.mjs"
	, "tests/helpers/generic-subtype-npm-browser-ci-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow.mjs"
	, "tests/helpers/optional-parameter-matrix-receipt-tests.mjs"
];
const implementationAdditions = [
	"scripts/reconcile-direct-proof-erasure-matrix.mjs"
	, "tests/helpers/direct-proof-erasure-matrix-receipt-tests.mjs"
	, "tests/helpers/direct-proof-erasure-matrix-receipt.mjs"
];
const integrationPaths = [
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-dispatch-bridge-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history-tests.mjs"
];
const historyAdditions = [
	"scripts/update-direct-proof-erasure-focused-ci-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-focused-ci-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-focused-ci-source-history.mjs"
];
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-focused-ci-source-history.mjs");
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
const implementationSources = implementationAdditions.map(path => ({
	path, sha256: sha256(git(["show", `${implementation}:${path}`]))
}));

const inventory = JSON.parse(git(["show", `${implementation}:${inventoryPath}`]));
const changedPaths = [...new Set([
	...implementationPaths, ...implementationAdditions
	, ...integrationPaths, ...historyAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = currentDigests.size === 0
	? { inventory, refreshed: 0 }
	: reconcileDependentCheckedRecordSourcePins(inventory, currentDigests);
assert.equal(reconciled.refreshed, 0);
assert.deepEqual(reconciled.inventory, inventory);

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-erasure-focused-ci-"));
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
		, { input: "Authenticate focused direct proof-erasure CI\n" }
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
		, milestone: "direct-proof-erasure-focused-ci-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Separate optional-parameter and direct proof-erasure acceptance behind explicit reusable-workflow inputs, retain the existing weekly subtype lanes without unrelated matrix cost, and expose one already registered proof-erasure workflow as a bounded ten-lane producer. Reconcile twenty canonical ordinary/reviewed reports from seventeen profiles into one exact-run fail-closed receipt. Preserve the existing low-cost audit as the default, retain identical package checkers and artifact prefixes, select the checksummed Perl 5.38.2 threaded toolchain explicitly, and make no support promotion before hosted evidence is retained."
		, calledWorkflowCount: 5, producerJobCount: 13
		, receiptJobCount: 1, artifactCount: 10, reportCount: 20
		, profileCount: 17, routeCount: 2, cellCount: 34
		, implementationAdditions: implementationSources
		, updates, integrationUpdates, currentSourcePaths
		, currentSourceDigests: currentSourcePaths.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, refreshedPins: reconciled.refreshed
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${implementationSources.length} implementation additions, `
		+ `${integrationUpdates.length} registrations and `
		+ `${reconciled.refreshed} live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
