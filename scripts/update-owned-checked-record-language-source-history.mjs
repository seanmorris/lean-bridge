#!/usr/bin/env node
/**
 * Record local Python, Ruby and Rust owned checked-record qualification.
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
	ownedCheckedRecordLanguageAddedPaths
	, ownedCheckedRecordLanguageChangedPaths
	, ownedCheckedRecordLanguageEvidencePath
	, ownedCheckedRecordLanguageHistoryPath
	, ownedCheckedRecordLanguageImplementation
	, ownedCheckedRecordLanguageImplementationPaths
	, ownedCheckedRecordLanguagePredecessor
	, reverseOwnedCheckedRecordLanguageUpdate
} from "../tests/helpers/owned-checked-record-language-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordLanguageImplementation
	, "Owned checked-record language history is draft-only at its implementation commit");
assert.equal(git(["merge-base", ownedCheckedRecordLanguagePredecessor
	, ownedCheckedRecordLanguageImplementation]).trim()
, ownedCheckedRecordLanguagePredecessor
, "Owned checked-record language implementation must descend from its predecessor");
for(const path of [ownedCheckedRecordLanguageHistoryPath
	, ownedCheckedRecordLanguageEvidencePath])
	assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", path]).trim(), ""
		, `Never rewrite committed evidence: ${path}`);
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordLanguagePredecessor
	, ownedCheckedRecordLanguageImplementation])
	.trim().split("\n").filter(Boolean).sort()
, [...ownedCheckedRecordLanguageImplementationPaths].sort());

const reportDirectory = "build/owned-checked-record-language-packaging";
const expected = new Map([
	["python", "reviewed-full"]
	, ["ruby", "ordinary-full"]
	, ["rust", "ordinary-result-only"]
]);
const selected = new Map();
for(const name of (await readdir(reportDirectory)).sort())
{
	if(!/^partial-[0-9a-f]{12}\.json$/u.test(name)) continue;
	const bytes = await readFile(join(reportDirectory, name));
	const wrapper = JSON.parse(bytes);
	assert.equal(wrapper.schemaVersion, 1);
	if(wrapper.selectedProfiles.length !== 1 || wrapper.reports.length !== 1) continue;
	const language = wrapper.selectedProfiles[0];
	const route = wrapper.reports[0];
	if(expected.get(language) !== route.route) continue;
	assert.equal(selected.has(language), false, language);
	selected.set(language, { rawReportSha256: sha256(bytes), route });
}
assert.deepEqual([...selected.keys()].sort(), [...expected.keys()].sort()
	, "Run the bounded Python, Ruby and Rust qualification routes first");

const reports = [...selected].sort(([left], [right]) =>
	left.localeCompare(right)).map(([language, { rawReportSha256, route }]) => {
	const observation = route.observations[language];
	assert.ok(observation, language);
	assert.equal(route.profiles.length, 1);
	assert.equal(route.profiles[0], language);
	assert.equal(route.sourceUnchanged, true);
	assert.equal(route.sourceFreeInstallation, true);
	assert.equal(route.relocatedInstallation, true);
	assert.equal(route.deterministicReassembly, true);
	assert.equal(observation.checks, observation.relocatedChecks);
	return {
		language, route: route.route, authorRoute: route.authorRoute
		, mode: route.mode, checks: observation.checks
		, relocatedChecks: observation.relocatedChecks
		, consumerSha256: observation.consumerSha256
		, sourceUnchanged: route.sourceUnchanged
		, sourceFreeInstallation: route.sourceFreeInstallation
		, relocatedInstallation: route.relocatedInstallation
		, deterministicReassembly: route.deterministicReassembly
		, exactApiMode: route.exactApiMode
		, earlyAndLateRejection: route.earlyAndLateRejection
		, unchangedRejectedInputs: route.unchangedRejectedInputs
		, transferredInputCheckedBeforeHandoff:
			route.transferredInputCheckedBeforeHandoff
		, mixedOwnedAndCopiedTransport: route.mixedOwnedAndCopiedTransport
		, hostCallbackRecovery: route.hostCallbackRecovery
		, returnedClosureRecovery: route.returnedClosureRecovery
		, constructorRejectionAndRecovery: route.constructorRejectionAndRecovery
		, handoffRemovedBeforeRelocatedExecution:
			route.handoffRemovedBeforeRelocatedExecution
		, lifecycle: route.lifecycle[language]
		, runtime: route.versions[language]
		, archive: route.reassembled[language]
		, bindingIrSha256: route.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(
			route.componentReceipts[language]
		))
		, packageSetReceiptSha256: sha256(canonicalJson(route.packageSetReceipt))
		, rawReportSha256
		, ...observation.installation
			? { installation: observation.installation } : {}
	};
	});
assert.deepEqual(reports.map(item => item.checks), [138, 138, 3]);
const commands = {
	python: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_PROFILES=python LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_ROUTES=reviewed-full node --test --test-concurrency=1 tests/owned-checked-record-language-packaging.test.mjs"
	, ruby: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_PROFILES=ruby LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_ROUTES=ordinary-full node --test --test-concurrency=1 tests/owned-checked-record-language-packaging.test.mjs"
	, rust: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_PROFILES=rust LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_ROUTES=ordinary-result-only node --test --test-concurrency=1 tests/owned-checked-record-language-packaging.test.mjs"
};
const qualification = canonicalJson({ schemaVersion: 1
	, profile: "installed-owned-checked-record-language-local-qualification"
	, implementationCommit: ownedCheckedRecordLanguageImplementation
	, scope: "bounded local qualification with one source-free relocated package per language; recurring CI retains the complete ordinary/reviewed and full/result-only matrix"
	, commands, reports });
const markdownPath
	= "docs/evidence/owned-checked-record-language-local-qualification-20261022.md";
const markdown = `# Python, Ruby and Rust owned checked-record local qualification\n\n`
	+ `Implementation: \`${ownedCheckedRecordLanguageImplementation}\`\n\n`
	+ `The reviewed Python wheel and ordinary Ruby gem completed 138 checks each. The ordinary result-only Rust crate completed 3 checks without callback declarations. Every package was rebuilt byte-for-byte, verified, installed without its author tree, relocated, and executed again from its public API.\n\n`
	+ `This is the bounded local qualification used before the evidence commit. The recurring workflow executes and retains every ordinary/reviewed, full/result-only route independently for Python, Ruby, and Rust.\n`;
await writeFile(ownedCheckedRecordLanguageEvidencePath
	, qualification, { flag: "wx" });
await writeFile(markdownPath, markdown, { flag: "wx" });

const typeSurfacePath = "docs/type-surface.v1.json";
const sourceTransitions = new Map();
for(const path of ownedCheckedRecordLanguageChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show"
		, `${ownedCheckedRecordLanguagePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}
const typeSurface = JSON.parse(git(["show"
	, `${ownedCheckedRecordLanguagePredecessor}:${typeSurfacePath}`]));
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
	, "The language milestone must refresh live source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, ownedCheckedRecordLanguageImplementation, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [typeSurfacePath
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-checked-record-language-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${ownedCheckedRecordLanguagePredecessor}:${path}`]);
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
	assert.equal(reverseOwnedCheckedRecordLanguageUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordLanguageChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of ownedCheckedRecordLanguageAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordLanguagePredecessor, "--", path]).trim(), "", path);
		const currentSha256 = path === ownedCheckedRecordLanguageEvidencePath
			? sha256(qualification) : sha256(await readFile(path));
		additions.push({ path, currentSha256 });
	}
	await writeFile(ownedCheckedRecordLanguageHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "owned-checked-record-language-source-v1"
			, predecessorCommit: ownedCheckedRecordLanguagePredecessor
			, implementationCommit: ownedCheckedRecordLanguageImplementation
			, acceptanceEvidence: {
				path: ownedCheckedRecordLanguageEvidencePath
				, sha256: sha256(qualification)
			}
			, refreshedTypeSurfacePointers: pointerUpdates.length
			, pointerUpdates, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} language owned checked-record transitions, ${additions.length} additions, three local routes and ${pointerUpdates.length} refreshed pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
