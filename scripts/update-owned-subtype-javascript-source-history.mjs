#!/usr/bin/env node
/**
 * Record installed JavaScript owned-Subtype evidence and source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	ownedSubtypeJavaScriptChangedPaths
	, ownedSubtypeJavaScriptEvidencePath
	, ownedSubtypeJavaScriptHistoryPath
	, ownedSubtypeJavaScriptImplementation
	, ownedSubtypeJavaScriptPredecessor
	, reverseOwnedSubtypeJavaScriptUpdate
} from "../tests/helpers/owned-subtype-javascript-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedSubtypeJavaScriptImplementation
	, "Owned Subtype JavaScript history is draft-only at its implementation commit");
for(const path of [ownedSubtypeJavaScriptHistoryPath
	, ownedSubtypeJavaScriptEvidencePath])
	assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", path]).trim(), ""
		, `Never rewrite committed evidence: ${path}`);

const reportPath = "build/owned-subtype-javascript-packaging/report.json";
const report = JSON.parse(await readFile(reportPath, "utf8"));
assert.equal(report.schemaVersion, 1);
assert.equal(report.profile, "installed-owned-subtype-javascript");
assert.equal(report.reports.length, 2);
assert.deepEqual(report.reports.map(item => item.reviewed), [false, true]);
for(const route of report.reports)
{
	assert.equal(route.installedNode, true);
	assert.equal(route.installedTypeScript, true);
	assert.equal(route.sourceRemovedBeforeInstall, true);
	assert.equal(route.archiveReproduction, true);
	assert.equal(route.browser?.installedSourcesRemoved, true);
	assert.equal(route.browser?.externalNetworkBlocked, true);
	assert.equal(route.browser?.executions?.length, 9);
	assert.deepEqual([...new Set(route.browser.executions.map(item => item.engine))]
		, ["chromium", "firefox", "webkit"]);
	assert.deepEqual([...new Set(route.browser.executions.map(item => item.profile))].sort()
		, ["page", "react", "worker"]);
	assert.ok(route.browser.executions.every(item => item.checks === 6
		&& item.reruns === 2 && item.assets.length === 2));
}
const acceptance = canonicalJson({ schemaVersion: 1
	, profile: report.profile
	, implementationCommit: ownedSubtypeJavaScriptImplementation
	, command: "LEAN_BRIDGE_OWNED_SUBTYPE_JS_TEST=1 LEAN_BRIDGE_OWNED_SUBTYPE_BROWSER_TEST=1 node --test --test-concurrency=1 tests/owned-subtype-javascript-packaging.test.mjs"
	, reports: report.reports });

const addedPaths = Object.freeze([
	ownedSubtypeJavaScriptEvidencePath
	, "docs/evidence/owned-subtype-javascript-acceptance-20261020.md"
	, "scripts/update-owned-subtype-javascript-source-history.mjs"
	, "tests/fixtures/onboarding/owned-subtypes/lakefile.toml"
	, "tests/fixtures/onboarding/owned-subtypes/lean-bridge.exports.json"
	, "tests/fixtures/onboarding/owned-subtypes/lean-toolchain"
	, "tests/helpers/owned-subtype-javascript-source-history.mjs"
	, "tests/helpers/owned-subtype-javascript-source-history-tests.mjs"
	, "tests/owned-subtype-javascript-packaging.test.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurface = JSON.parse(await readFile(typeSurfacePath, "utf8"));
const actualHashes = new Map(); let reconciled = 0;
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		let actual = actualHashes.get(file.path);
		if(actual === undefined)
		{
			actual = sha256(await readFile(file.path));
			actualHashes.set(file.path, actual);
		}
		if(file.sha256 !== actual)
		{ file.sha256 = actual; reconciled++; }
	}
assert.ok(reconciled > 0, "Type-surface reconciliation must advance live sources");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-subtype-javascript-history-"
));
const sourceTransition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous); await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("") };
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseOwnedSubtypeJavaScriptUpdate(current, update), previous);
	return update;
};
const transition = async path => sourceTransition(path
	, git(["show", `${ownedSubtypeJavaScriptPredecessor}:${path}`])
	, await readFile(path, "utf8"));
const historicalCorrectionSpecs = Object.freeze([
	{ currentCommit: "526e9642f0facd00a4b6dc49dedb585471cf8a38"
		, previousCommit: "4d4c810ab4b8cc64a60286a3ed4d3292d76fda02"
		, path: typeSurfacePath }
	, { currentCommit: "f34d7fe555c63889f7344b6a88ebfc17140c8a32"
		, previousCommit: "bbefa9ea6fc15b86c1ea533ecedebc87f13a5eec"
		, path: typeSurfacePath }
	, { currentCommit: "f34d7fe555c63889f7344b6a88ebfc17140c8a32"
		, previousCommit: "bbefa9ea6fc15b86c1ea533ecedebc87f13a5eec"
		, path: "tests/helpers/fin-refinement-source-history.mjs" }
]);

try
{
	const updates = [];
	for(const path of ownedSubtypeJavaScriptChangedPaths)
		updates.push(await transition(path));
	const historicalCorrections = [];
	for(const correction of historicalCorrectionSpecs)
	{
		assert.equal(git(["rev-parse", `${correction.currentCommit}^`]).trim()
			, correction.previousCommit);
		const update = await sourceTransition(correction.path
			, git(["show", `${correction.previousCommit}:${correction.path}`])
			, git(["show", `${correction.currentCommit}:${correction.path}`]));
		historicalCorrections.push({ ...correction, ...update });
	}
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeJavaScriptPredecessor, "--", path]).trim(), "", path);
		additions.push({ path
			, currentSha256: path === ownedSubtypeJavaScriptEvidencePath
				? sha256(acceptance) : sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, ownedSubtypeJavaScriptImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"docs/javascript-typescript.md"
		, "docs/lean/diagnostics.md"
		, "docs/lean/existing-package.md"
		, "docs/type-surface.v1.json"
		, "nix/component-engine-source-boundary.json"
		, "tests/engine-execution-request.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/owned-refinement-carriers-source-history-tests.mjs"
		, "tests/helpers/owned-refinement-model-source-history-tests.mjs"
		, "tests/helpers/owned-subtype-analysis-source-history-tests.mjs"
		, "tests/owned-aggregate-model.test.mjs"
	].sort());
	const history = { schemaVersion: 1
		, milestone: "owned-subtype-javascript-source-v1"
		, predecessorCommit: ownedSubtypeJavaScriptPredecessor
		, implementationCommit: ownedSubtypeJavaScriptImplementation
		, reconciledTypeSurfacePointers: reconciled
		, acceptanceEvidence: { path: ownedSubtypeJavaScriptEvidencePath
			, sha256: sha256(acceptance) }
		, historicalCorrections
		, scope: "Ordinary and independently reviewed npm packages, Node, strict TypeScript, and page, React and worker execution in Chromium, Firefox and WebKit for borrowed acyclic owned records. The record also repairs two exact earlier type-surface pointer-history gaps without changing support claims. Transfer, explicit retain variants, callbacks, recursive mirrors and other hosts remain open."
		, updates, additions };
	await writeFile(ownedSubtypeJavaScriptEvidencePath, acceptance, { flag: "wx" });
	await writeFile(ownedSubtypeJavaScriptHistoryPath
		, canonicalJson(history), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${historicalCorrections.length} corrections, ${additions.length} additions and two installed routes.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
