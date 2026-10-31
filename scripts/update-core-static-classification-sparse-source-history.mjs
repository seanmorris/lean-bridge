#!/usr/bin/env node
/**
 * Record the sparse Core static-classification repair.
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
	coreStaticClassificationSparseHistoryAdditions
	, coreStaticClassificationSparseHistoryPath
	, coreStaticClassificationSparseImplementation
	, coreStaticClassificationSparseImplementationPaths
	, coreStaticClassificationSparseIntegrationPaths
	, coreStaticClassificationSparsePins
	, coreStaticClassificationSparsePredecessor
} from "../tests/helpers/core-static-classification-sparse-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-static-classification-sparse-source-history.mjs");
assert.equal(existsSync(coreStaticClassificationSparseHistoryPath), false
	, coreStaticClassificationSparseHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreStaticClassificationSparseImplementation);
assert.equal(git(["rev-parse"
	, coreStaticClassificationSparseImplementation + "^"]).trim()
, coreStaticClassificationSparsePredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreStaticClassificationSparsePredecessor
	, coreStaticClassificationSparseImplementation, "--"])
, [...coreStaticClassificationSparseImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreStaticClassificationSparsePredecessor
	, coreStaticClassificationSparseImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, coreStaticClassificationSparseImplementation + ":"
		+ coreStaticClassificationSparseHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreStaticClassificationSparseIntegrationPaths])
, [...coreStaticClassificationSparseIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreStaticClassificationSparseHistoryAdditions])
, [...coreStaticClassificationSparseHistoryAdditions].sort());

const inventoryPath = coreStaticClassificationSparseImplementationPaths[0];
const before = git(["show"
	, coreStaticClassificationSparsePredecessor + ":" + inventoryPath]);
const after = git(["show"
	, coreStaticClassificationSparseImplementation + ":" + inventoryPath]);
let restored = after;
for(const pin of coreStaticClassificationSparsePins)
{
	restored = restored.replaceAll(pin.current, pin.previous);
	assert.equal(after.split(pin.current).length - 1, pin.count);
	assert.equal(after.includes(pin.previous), false);
	assert.equal(sha256(await readFile(pin.path)), pin.current);
}
assert.equal(restored, before);
const inventory = JSON.parse(after);
const typeSurfaceCounts = Object.fromEntries([
	"evidence", "observations", "paths", "positions", "profiles", "stages"
].map(key => [key, inventory[key].length]));

const packageDocument = JSON.parse(await readFile("package.json", "utf8"));
const profileTest = await readFile("tests/test-profiles.test.mjs", "utf8");
const checked = await readFile("tests/checked-javascript.test.mjs", "utf8");
assert.match(packageDocument.scripts["env:check:core"]
	, /test-name-pattern=.*execution profile.*test-profiles\.test\.mjs/u);
assert.doesNotMatch(profileTest
	, /^import .*test-registration-history\.mjs/mu);
assert.match(profileTest
	, /await import\(\s*"\.\/helpers\/test-registration-history\.mjs"\)/u);
assert.ok(checked.includes(
	"test-name-pattern=.*execution profile.*test-profiles\\.test\\.mjs"));

const updates = [];
for(const path of coreStaticClassificationSparseImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreStaticClassificationSparsePredecessor
		, coreStaticClassificationSparseImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-static-classification-sparse-"));
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
	temporaryGit(["read-tree", coreStaticClassificationSparseImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreStaticClassificationSparseIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreStaticClassificationSparseImplementation
	], { input: "Authenticate sparse Core static classification\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreStaticClassificationSparseIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreStaticClassificationSparseImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreStaticClassificationSparseHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreStaticClassificationSparseHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-static-classification-sparse-source-v1"
		, predecessorCommit: coreStaticClassificationSparsePredecessor
		, implementationCommit: coreStaticClassificationSparseImplementation
		, failedWorkflowRun: 41171335673
		, failedStaticJob: 124450245666
		, failedAt: "2026-10-31T05:19:19Z"
		, failureClass: "deterministic sparse-checkout ENOENT"
		, missingPath: "docs/evidence/optional-parameter-dispatch-bridge-source-history-20261029.json"
		, rootCause: "The static classifier executed tests/test-profiles.test.mjs, whose top-level history-helper import eagerly read retained evidence excluded from the static checkout."
		, scope: "Run only the closed repository-test classifier in the static Core preflight; lazy-load retained history only inside its full-contract test. Preserve the full historical registration test, every type-surface observation and evidence identity, and the complete checked-JavaScript quality contract. Refresh exactly the 29 citations for the two implementation sources."
		, refreshedCitationCount: coreStaticClassificationSparsePins
			.reduce((total, pin) => total + pin.count, 0)
		, semanticChanges: 0, typeSurfaceCounts
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions and 29 pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
