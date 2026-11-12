#!/usr/bin/env node
/**
 * Record the complete public-pin follow-up to the release-gate repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { typeSurfaceEvidenceFiles }
	from "../src/adoption/type-surface-evidence-receipt.mjs";
import { auditCurrentSourcePins }
	from "../tests/helpers/current-source-pin-preflight.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	vo1220ReleaseGateSitePinAddedPaths
	, vo1220ReleaseGateSitePinHistoryPath
	, vo1220ReleaseGateSitePinImplementation
	, vo1220ReleaseGateSitePinImplementationPaths
	, vo1220ReleaseGateSitePinIntegrationPaths
	, vo1220ReleaseGateSitePinPredecessor
} from "../tests/helpers/vo1220-release-gate-site-pin-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-release-gate-site-pin-source-history.mjs");
assert.equal(existsSync(vo1220ReleaseGateSitePinHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, vo1220ReleaseGateSitePinImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, vo1220ReleaseGateSitePinPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, vo1220ReleaseGateSitePinPredecessor
	, vo1220ReleaseGateSitePinImplementation])
, [...vo1220ReleaseGateSitePinImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...vo1220ReleaseGateSitePinIntegrationPaths])
, [...vo1220ReleaseGateSitePinIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...vo1220ReleaseGateSitePinAddedPaths])
, [...vo1220ReleaseGateSitePinAddedPaths].sort());

const inventoryPath = "docs/type-surface.v1.json";
const sitePath = "site/workflows.test.mjs";
const beforeText = git(["show"
	, `${vo1220ReleaseGateSitePinPredecessor}:${inventoryPath}`]);
const afterText = git(["show"
	, `${vo1220ReleaseGateSitePinImplementation}:${inventoryPath}`]);
const before = JSON.parse(beforeText), after = JSON.parse(afterText);
assert.deepEqual(after.profiles, before.profiles);
assert.deepEqual(after.observations, before.observations);
const previous = "7202a6992a392f38471b2a9815c47149a40e2adea0b0982756e83fce0dcbb208";
const current = sha256(git(["show"
	, `${vo1220ReleaseGateSitePinImplementation}:${sitePath}`]));
assert.equal(current
	, "9a956e1ae139d30a8456c11c6775f001c1b3cdf5ed1d75a3b440b019b5e0c167");
const beforePins = before.evidence.flatMap(item => item.files).filter(file =>
	file.path === sitePath);
const afterPins = after.evidence.flatMap(item => item.files).filter(file =>
	file.path === sitePath);
assert.equal(beforePins.length, 3);
assert.equal(afterPins.length, 3);
assert.deepEqual([...new Set(beforePins.map(file => file.sha256))], [previous]);
assert.deepEqual([...new Set(afterPins.map(file => file.sha256))], [current]);

const liveFiles = typeSurfaceEvidenceFiles(after).filter(file =>
	!file.path.startsWith("docs/evidence/"));
const uniquePaths = [...new Set(liveFiles.map(file => file.path))];
const digests = new Map();
for(const path of uniquePaths)
	digests.set(path, createHash("sha256").update(await readFile(path)).digest("hex"));
const findings = liveFiles.filter(file => digests.get(file.path) !== file.sha256)
	.map(file => ({ path: file.path, actual: digests.get(file.path)
		, expected: file.sha256 }));
assert.equal(uniquePaths.length, 2661);
assert.equal(liveFiles.length, 2661);
assert.deepEqual(findings, []);
const liveAudit = await auditCurrentSourcePins(after);
assert.deepEqual(liveAudit, {
	cohort: 2661, occurrences: 16326, findings: []
});

const updates = [];
for(const path of vo1220ReleaseGateSitePinImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, vo1220ReleaseGateSitePinPredecessor
		, vo1220ReleaseGateSitePinImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-release-gate-site-pin-"));
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
	temporaryGit(["read-tree", vo1220ReleaseGateSitePinImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...vo1220ReleaseGateSitePinIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", vo1220ReleaseGateSitePinImplementation
	], { input: "Authenticate release-gate site-pin closure\n" }).trim();
	const integrationUpdates = [];
	for(const path of vo1220ReleaseGateSitePinIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, vo1220ReleaseGateSitePinImplementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of vo1220ReleaseGateSitePinAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(vo1220ReleaseGateSitePinHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-release-gate-site-pin-v1"
		, predecessorCommit: vo1220ReleaseGateSitePinPredecessor
		, implementationCommit: vo1220ReleaseGateSitePinImplementation
		, integrationCommit
		, failedRun: {
			workflow: 43282516514, job: 131407246879
			, failure: "three stale public citations for site/workflows.test.mjs"
		}
		, rootCause: "The repaired site assertion was authenticated, but its three public type-surface citations still named the predecessor digest. Full-checkout site generation therefore refused stale source evidence before executing the corrected assertion."
		, scope: "Advance exactly three citations for site/workflows.test.mjs, audit every current live-source citation in one pass, and preserve all support profiles, observations, exact-model cells, runtime behavior, proofs, packages and immutable prior receipts."
		, siteSource: { path: sitePath, previousSha256: previous
			, currentSha256: current }
		, refreshedPins: 3, liveSourcePaths: liveAudit.cohort
		, liveSourceOccurrences: liveAudit.occurrences, remainingMismatches: 0
		, updates, integrationUpdates, additions
	}), { flag: "wx" });
	process.stdout.write("Recorded three public-pin updates and complete live-source closure.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
