#!/usr/bin/env node
/**
 * Record local .NET, JVM, native PHP and WIT owned checked-record qualification.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	ownedCheckedRecordManagedAddedPaths
	, ownedCheckedRecordManagedChangedPaths
	, ownedCheckedRecordManagedEvidencePath
	, ownedCheckedRecordManagedHistoryPath
	, ownedCheckedRecordManagedImplementation
	, ownedCheckedRecordManagedImplementationPaths
	, ownedCheckedRecordManagedPredecessor
	, reverseOwnedCheckedRecordManagedUpdate
} from "../tests/helpers/owned-checked-record-managed-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordManagedImplementation
	, "Owned checked-record managed history is draft-only at its implementation commit");
assert.equal(git(["merge-base", ownedCheckedRecordManagedPredecessor
	, ownedCheckedRecordManagedImplementation]).trim()
, ownedCheckedRecordManagedPredecessor
, "Owned checked-record managed implementation must descend from its predecessor");
for(const path of [ownedCheckedRecordManagedHistoryPath
	, ownedCheckedRecordManagedEvidencePath])
	assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", path]).trim(), ""
		, `Never rewrite committed evidence: ${path}`);
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordManagedPredecessor
	, ownedCheckedRecordManagedImplementation])
	.trim().split("\n").filter(Boolean).sort()
, [...ownedCheckedRecordManagedImplementationPaths].sort());

const reportDirectory = "build/owned-checked-record-managed-packaging";
const expected = new Map([
	["dotnet", "ordinary-result-only"]
	, ["jvm", "ordinary-full"]
	, ["php", "ordinary-full"]
	, ["wit", "ordinary-full"]
]);
const selected = new Map();
for(const name of (await readdir(reportDirectory)).sort())
{
	const match = /^(dotnet|jvm|php|wit)\.json$/u.exec(name);
	if(!match) continue;
	const bytes = await readFile(join(reportDirectory, name));
	const wrapper = JSON.parse(bytes);
	assert.equal(wrapper.schemaVersion, 1);
	if(wrapper.reports.length !== 1) continue;
	const group = match[1];
	assert.equal(wrapper.group, group);
	const route = wrapper.reports[0];
	if(expected.get(group) !== route.route) continue;
	assert.equal(selected.has(group), false, group);
	selected.set(group, { rawReportSha256: sha256(bytes), route });
}
assert.deepEqual([...selected.keys()].sort(), [...expected.keys()].sort()
	, "Run the bounded .NET, JVM, native PHP and WIT qualification routes first");

const reports = [...selected].flatMap(([group
	, { rawReportSha256, route }]) => route.profiles.map(profile => {
	const observation = route.observations[profile];
	assert.ok(observation, profile);
	assert.equal(route.sourceUnchanged, true);
	assert.equal(route.sourceFreeInstallation, true);
	assert.equal(route.relocatedInstallation, true);
	assert.equal(route.deterministicReassembly, true);
	assert.equal(observation.checks, route.repeated[profile].checks);
	return {
		profile, group, route: route.route, authorRoute: route.authorRoute
		, mode: route.mode, checks: observation.checks
		, relocatedChecks: route.repeated[profile].checks
		, consumerSha256: observation.consumerSha256
		, sourceUnchanged: route.sourceUnchanged
		, sourceFreeInstallation: route.sourceFreeInstallation
		, relocatedInstallation: route.relocatedInstallation
		, deterministicReassembly: route.deterministicReassembly
		, handoffRemovedBeforeRelocatedExecution:
			route.handoffRemovedBeforeRelocatedExecution
		, immutableInstalledInputs: route.immutableInstalledInputs
		, archives: route.reassembled.packages
		, componentReceiptSha256: route.reassembled.componentReceiptSha256
		, packageSetReceiptSha256: route.packageSetReceiptSha256
		, rawReportSha256
	};})
).toSorted((left, right) => left.profile.localeCompare(right.profile));
assert.deepEqual(reports.map(item => item.checks), [4, 121, 119, 120, 261]);
const commands = {
	dotnet: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_GROUPS=dotnet LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_ROUTES=ordinary-result-only node --test --test-concurrency=1 tests/owned-checked-record-managed-packaging.test.mjs"
	, jvm: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_GROUPS=jvm LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_ROUTES=ordinary-full node --test --test-concurrency=1 tests/owned-checked-record-managed-packaging.test.mjs"
	, php: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_GROUPS=php LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_ROUTES=ordinary-full node --test --test-concurrency=1 tests/owned-checked-record-managed-packaging.test.mjs"
	, wit: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_GROUPS=wit LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_ROUTES=ordinary-full node --test --test-concurrency=1 tests/owned-checked-record-managed-packaging.test.mjs"
};
const qualification = canonicalJson({ schemaVersion: 1
	, profile: "installed-owned-checked-record-managed-local-qualification"
	, implementationCommit: ownedCheckedRecordManagedImplementation
	, scope: "bounded local qualification with one source-free relocated package per host family; recurring CI retains the complete ordinary/reviewed and full/result-only matrix"
	, commands, reports });
const markdownPath
	= "docs/evidence/owned-checked-record-managed-local-qualification-20261022.md";
const markdown = `# .NET, JVM, native PHP and WIT owned checked-record local qualification\n\n`
	+ `Implementation: \`${ownedCheckedRecordManagedImplementation}\`\n\n`
	+ `The ordinary full Maven package completed 121 Java and 119 Kotlin checks; Composer completed 120; WIT/WASI completed 261. The ordinary result-only NuGet package completed 4 checks without callback declarations. Every package was rebuilt byte-for-byte, verified, installed without its author tree, relocated, and executed again from its public API.\n\n`
	+ `This is the bounded local qualification used before the evidence commit. The recurring workflow executes and retains every ordinary/reviewed, full/result-only route independently for .NET, JVM, native PHP, and WIT.\n`;
await writeFile(ownedCheckedRecordManagedEvidencePath
	, qualification, { flag: "wx" });
await writeFile(markdownPath, markdown, { flag: "wx" });

const typeSurfacePath = "docs/type-surface.v1.json";
const sourceTransitions = new Map();
for(const path of ownedCheckedRecordManagedChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show"
		, `${ownedCheckedRecordManagedPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}
const typeSurface = JSON.parse(git(["show"
	, `${ownedCheckedRecordManagedPredecessor}:${typeSurfacePath}`]));
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
	, "The managed milestone must refresh live source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, ownedCheckedRecordManagedImplementation, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [typeSurfacePath
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-checked-record-managed-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${ownedCheckedRecordManagedPredecessor}:${path}`]);
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
	assert.equal(reverseOwnedCheckedRecordManagedUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordManagedChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of ownedCheckedRecordManagedAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordManagedPredecessor, "--", path]).trim(), "", path);
		const currentSha256 = path === ownedCheckedRecordManagedEvidencePath
			? sha256(qualification) : sha256(await readFile(path));
		additions.push({ path, currentSha256 });
	}
	await writeFile(ownedCheckedRecordManagedHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "owned-checked-record-managed-source-v1"
			, predecessorCommit: ownedCheckedRecordManagedPredecessor
			, implementationCommit: ownedCheckedRecordManagedImplementation
			, acceptanceEvidence: {
				path: ownedCheckedRecordManagedEvidencePath
				, sha256: sha256(qualification)
			}
			, refreshedTypeSurfacePointers: pointerUpdates.length
			, pointerUpdates, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} managed owned checked-record transitions, ${additions.length} additions, four local routes and ${pointerUpdates.length} refreshed pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
