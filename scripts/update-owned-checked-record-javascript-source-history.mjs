#!/usr/bin/env node
/**
 * Record installed JavaScript owned checked-record evidence and source history.
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
	ownedCheckedRecordJavaScriptAddedPaths
	, ownedCheckedRecordJavaScriptChangedPaths
	, ownedCheckedRecordJavaScriptEvidencePath
	, ownedCheckedRecordJavaScriptHistoryPath
	, ownedCheckedRecordJavaScriptImplementation
	, ownedCheckedRecordJavaScriptImplementationPaths
	, ownedCheckedRecordJavaScriptPredecessor
	, reverseOwnedCheckedRecordJavaScriptUpdate
} from "../tests/helpers/owned-checked-record-javascript-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordJavaScriptImplementation
	, "Owned checked-record JavaScript history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, ownedCheckedRecordJavaScriptPredecessor
	, "Owned checked-record JavaScript implementation must keep its exact predecessor");
for(const path of [ownedCheckedRecordJavaScriptHistoryPath
	, ownedCheckedRecordJavaScriptEvidencePath])
	assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", path]).trim(), ""
		, `Never rewrite committed evidence: ${path}`);
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordJavaScriptPredecessor
	, ownedCheckedRecordJavaScriptImplementation])
	.trim().split("\n").filter(Boolean).sort()
, [...ownedCheckedRecordJavaScriptImplementationPaths
	, "tests/helpers/owned-checked-record-javascript-fixture.mjs"
	, "tests/owned-checked-record-javascript-packaging.test.mjs"].sort());

const reportPath = "build/owned-checked-record-javascript-packaging/report.json";
const report = JSON.parse(await readFile(reportPath, "utf8"));
assert.equal(report.schemaVersion, 1);
assert.equal(report.profile, "installed-owned-checked-record-javascript");
assert.deepEqual(report.reports.map(item => item.route), [
	"ordinary-full", "ordinary-result-only"
	, "reviewed-full", "reviewed-result-only"
]);
for(const route of report.reports)
{
	const resultOnly = route.mode === "result-only";
	assert.equal(route.authorRoute
		, route.route.startsWith("reviewed-") ? "reviewed" : "ordinary");
	assert.equal(resultOnly, route.route.endsWith("-result-only"));
	assert.equal(route.installedNode, true);
	assert.equal(route.installedTypeScript, true);
	assert.equal(route.sourceRemovedBeforeInstall, true);
	assert.equal(route.relocatedInstallation, true);
	assert.equal(route.archiveReproduction, true);
	assert.match(route.componentIdentity, /^[0-9a-f]{64}$/u);
	assert.match(route.bindingIrSha256, /^[0-9a-f]{64}$/u);
	assert.equal(typeof route.sourceIdentity, "object");
	assert.match(sha256(canonicalJson(route.sourceIdentity)), /^[0-9a-f]{64}$/u);
	assert.match(route.archives.runtime, /^[0-9a-f]{64}$/u);
	assert.match(route.archives.component, /^[0-9a-f]{64}$/u);
	assert.equal(route.observed.checks, resultOnly ? 7 : 30);
	assert.equal(route.browser?.installedSourcesRemoved, true);
	assert.equal(route.browser?.externalNetworkBlocked, true);
	assert.equal(route.browser?.executions?.length, 9);
	assert.deepEqual([...new Set(route.browser.executions.map(item => item.engine))]
		, ["chromium", "firefox", "webkit"]);
	assert.deepEqual([...new Set(route.browser.executions.map(item => item.profile))].sort()
		, ["page", "react", "worker"]);
	assert.ok(route.browser.executions.every(item =>
		item.checks === route.observed.checks
		&& item.reruns === 2 && item.assets.length === 2
	));
}
assert.notEqual(sha256(canonicalJson(report.reports[0].sourceIdentity))
	, sha256(canonicalJson(report.reports[2].sourceIdentity))
	, "Ordinary and reviewed evidence must retain independent source identities");
const command = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_JS_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST=1 node --test --test-concurrency=1 tests/owned-checked-record-javascript-packaging.test.mjs";
const acceptance = canonicalJson({ schemaVersion: 1
	, profile: report.profile
	, implementationCommit: ownedCheckedRecordJavaScriptImplementation
	, command, reports: report.reports });
const markdownPath
	= "docs/evidence/owned-checked-record-javascript-acceptance-20261022.md";
const markdown = `# Installed owned checked-record JavaScript acceptance\n\n`
	+ `Implementation: \`${ownedCheckedRecordJavaScriptImplementation}\`\n\n`
	+ `The ordinary-source and independently reviewed Binding IR roots each produced full and result-only npm packages. All four packages were rebuilt byte-for-byte, installed offline after authored sources and build outputs were removed, relocated, and executed through Node.js and strict TypeScript.\n\n`
	+ `Chromium, Firefox, and WebKit each executed a page, a React Strict Mode application, and a worker twice per package. Full packages completed 30 semantic checks; result-only packages completed 7. The full surface covers borrowed, retained, and transferred resources, a copied nested checked record, rejection before and after partial conversion, checked host callback replies, thrown callback identity, returned Lean closures, recovery, disposal, and engine shutdown.\n\n`
	+ `Command: \`${command}\`\n`;
await writeFile(ownedCheckedRecordJavaScriptEvidencePath
	, acceptance, { flag: "wx" });
await writeFile(markdownPath, markdown, { flag: "wx" });

const typeSurfacePath = "docs/type-surface.v1.json";
const sourceTransitions = new Map();
for(const path of ownedCheckedRecordJavaScriptChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show"
		, `${ownedCheckedRecordJavaScriptPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}
const typeSurface = JSON.parse(git(["show"
	, `${ownedCheckedRecordJavaScriptPredecessor}:${typeSurfacePath}`]));
const pointerUpdates = [];
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const transition = sourceTransitions.get(file.path);
		if(!transition || file.sha256 !== transition.previous) continue;
		file.sha256 = transition.current;
		pointerUpdates.push({ path: file.path, ...transition });
	}
assert.ok(pointerUpdates.length > 0
	, "The installed checked-record milestone must refresh live source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, ownedCheckedRecordJavaScriptImplementation, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [typeSurfacePath
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-checked-record-javascript-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${ownedCheckedRecordJavaScriptPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
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
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseOwnedCheckedRecordJavaScriptUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordJavaScriptChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of ownedCheckedRecordJavaScriptAddedPaths)
	{
		const predecessorPath = git(["ls-tree", "--name-only"
			, ownedCheckedRecordJavaScriptPredecessor, "--", path]).trim();
		assert.equal(predecessorPath, "", path);
		const currentSha256 = path === ownedCheckedRecordJavaScriptEvidencePath
			? sha256(acceptance) : sha256(await readFile(path));
		additions.push({ path, currentSha256 });
	}
	await writeFile(ownedCheckedRecordJavaScriptHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "owned-checked-record-javascript-source-v1"
			, predecessorCommit: ownedCheckedRecordJavaScriptPredecessor
			, implementationCommit: ownedCheckedRecordJavaScriptImplementation
			, acceptanceEvidence: {
				path: ownedCheckedRecordJavaScriptEvidencePath
				, sha256: sha256(acceptance)
			}
			, refreshedTypeSurfacePointers: pointerUpdates.length
			, pointerUpdates, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} installed owned checked-record transitions, ${additions.length} additions, four routes and ${pointerUpdates.length} refreshed pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
