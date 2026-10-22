#!/usr/bin/env node
/**
 * Record local native/Perl owned checked-record qualification and source history.
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
	ownedCheckedRecordNativePerlAddedPaths
	, ownedCheckedRecordNativePerlChangedPaths
	, ownedCheckedRecordNativePerlEvidencePath
	, ownedCheckedRecordNativePerlHistoryPath
	, ownedCheckedRecordNativePerlImplementation
	, ownedCheckedRecordNativePerlImplementationPaths
	, ownedCheckedRecordNativePerlPredecessor
	, reverseOwnedCheckedRecordNativePerlUpdate
} from "../tests/helpers/owned-checked-record-native-perl-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordNativePerlImplementation
	, "Owned checked-record native/Perl history is draft-only at its implementation commit");
const mergeBase = git(["merge-base"
	, ownedCheckedRecordNativePerlPredecessor
	, ownedCheckedRecordNativePerlImplementation]).trim();
assert.equal(mergeBase, ownedCheckedRecordNativePerlPredecessor
	, "Owned checked-record native/Perl implementation must descend from its predecessor");
for(const path of [ownedCheckedRecordNativePerlHistoryPath
	, ownedCheckedRecordNativePerlEvidencePath])
	assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", path]).trim(), ""
		, `Never rewrite committed evidence: ${path}`);
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordNativePerlPredecessor
	, ownedCheckedRecordNativePerlImplementation])
	.trim().split("\n").filter(Boolean).sort()
, [...ownedCheckedRecordNativePerlImplementationPaths].sort());

const readReports = async directory => {
	const names = (await readdir(directory)).filter(name =>
		/^partial-[0-9a-f]{12}\.json$/u.test(name)
	).sort();
	assert.equal(names.length, 2, directory);
	const reports = [];
	for(const name of names)
	{
		const bytes = await readFile(join(directory, name));
		const report = JSON.parse(bytes);
		assert.equal(report.schemaVersion, 1);
		assert.equal(report.reports.length, 1);
		reports.push({ rawReportSha256: sha256(bytes), report: report.reports[0] });
	}
	return reports.toSorted((left, right) =>
		left.report.route.localeCompare(right.report.route));
};
const nativeRaw = await readReports(
	"build/owned-checked-record-native-packaging"
);
const perlRaw = await readReports(
	"build/owned-checked-record-perl-packaging"
);
for(const reports of [nativeRaw, perlRaw])
	assert.deepEqual(reports.map(item => item.report.route)
		, ["ordinary-full", "ordinary-result-only"]);
for(const { report: route } of nativeRaw)
{
	const resultOnly = route.mode === "result-only";
	assert.equal(route.authorRoute, "ordinary");
	assert.equal(route.sourceUnchanged, true);
	assert.equal(route.sourceFreeInstallation, true);
	assert.equal(route.relocatedInstallation, true);
	assert.equal(route.deterministicReassembly, true);
	assert.equal(route.observed.c.checks, resultOnly ? 14 : 261);
	assert.equal(route.observed.cpp.checks, resultOnly ? 3 : 125);
	assert.equal(Boolean(route.relocated.cpp.sanitizer), !resultOnly);
}
for(const { report: route } of perlRaw)
{
	const checks = route.mode === "result-only" ? 9 : 63;
	assert.equal(route.authorRoute, "ordinary");
	assert.equal(route.sourceUnchanged, true);
	assert.equal(route.sourceFreeInstallation, true);
	assert.equal(route.relocatedInstallation, true);
	assert.equal(route.deterministicReassembly, true);
	assert.equal(route.independentlyVerified, true);
	assert.equal(route.observations.length, 8);
	assert.ok(route.observations.every(item =>
		item.runtimeOnlyRuns === 2 && item.observed.checks === checks
		&& item.assets.observations.length === 6
	));
}
const common = route => ({ route: route.route, authorRoute: route.authorRoute
	, mode: route.mode, bindingIrSha256: route.bindingIrSha256
	, sourceUnchanged: route.sourceUnchanged
	, sourceFreeInstallation: route.sourceFreeInstallation
	, relocatedInstallation: route.relocatedInstallation
	, deterministicReassembly: route.deterministicReassembly
	, earlyAndLateRejection: route.earlyAndLateRejection
	, unchangedRejectedInputs: route.unchangedRejectedInputs
	, callbackRecovery: route.callbackRecovery
	, componentReceiptSha256: sha256(canonicalJson(route.componentReceipt))
	, packageSetReceiptSha256: sha256(canonicalJson(route.packageSetReceipt)) });
const nativeReports = nativeRaw.map(({ rawReportSha256, report }) => ({
	...common(report), rawReportSha256
	, outputAtomicity: report.outputAtomicity
	, lifecycle: report.lifecycle
	, consumers: Object.fromEntries(["c", "cpp"].map(profile => [profile, {
		checks: report.observed[profile].checks
		, consumerSha256: report.observed[profile].consumerSha256
		, compilerFreePath: report.observed[profile].compilerFreePath
		, offlineInstall: report.observed[profile].offlineInstall
		, relocatedSourceSha256: report.relocated[profile].sourceSha256
		, sanitizer: report.relocated[profile].sanitizer
	}]))
}));
const perlRuntime = value => {
	const match = value.match(/\/perl\/([^/]+)\/bin\/perl$/u);
	assert.ok(match, value);
	return match[1];
};
const perlReports = perlRaw.map(({ rawReportSha256, report }) => ({
	...common(report), rawReportSha256
	, independentlyVerified: report.independentlyVerified
	, immutableConsumer: report.immutableConsumer
	, lifecycle: report.lifecycle
	, consumerSha256: report.consumerSha256
	, observations: report.observations.map(item => ({
		runtime: perlRuntime(item.perl), mode: item.mode
		, runtimeOnlyRuns: item.runtimeOnlyRuns
		, observed: item.observed
		, assetInspectorSha256: item.assets.sourceSha256
		, assets: item.assets.observations
	}))
}));
const commands = {
	native: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_NATIVE_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_NATIVE_ROUTES=<ordinary-full|ordinary-result-only> node --test --test-concurrency=1 tests/owned-checked-record-native-packaging.test.mjs"
	, perl: "LEAN_BRIDGE_OWNED_CHECKED_RECORD_PERL_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_PERL_ROUTES=<ordinary-full|ordinary-result-only> node --test --test-concurrency=1 tests/owned-checked-record-perl-packaging.test.mjs"
};
const qualification = canonicalJson({ schemaVersion: 1
	, profile: "installed-owned-checked-record-native-perl-local-qualification"
	, implementationCommit: ownedCheckedRecordNativePerlImplementation
	, scope: "ordinary full and result-only local qualification; recurring CI retains the complete ordinary/reviewed matrix"
	, commands, nativeReports, perlReports });
const markdownPath
	= "docs/evidence/owned-checked-record-native-perl-local-qualification-20261022.md";
const markdown = `# Native and Perl owned checked-record local qualification\n\n`
	+ `Implementation: \`${ownedCheckedRecordNativePerlImplementation}\`\n\n`
	+ `The ordinary-source full and result-only packages were rebuilt byte-for-byte, verified, installed without their author trees, relocated, and executed from their public C, C++, and Perl APIs. The full C consumer completed 261 checks, C++ completed 125 with ASan, UBSan, and LSan, and every one of the eight Perl ABI/install combinations completed 63 checks plus six cold/warm installed-asset tamper controls. Result-only packages completed 14 C, 3 C++, and 9 Perl checks per Perl combination without relying on callback declarations.\n\n`
	+ `This is the bounded local qualification used before the milestone push. The recurring workflow executes and retains the complete ordinary/reviewed, full/result-only matrix.\n`;
await writeFile(ownedCheckedRecordNativePerlEvidencePath
	, qualification, { flag: "wx" });
await writeFile(markdownPath, markdown, { flag: "wx" });

const typeSurfacePath = "docs/type-surface.v1.json";
const sourceTransitions = new Map();
for(const path of ownedCheckedRecordNativePerlChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show"
		, `${ownedCheckedRecordNativePerlPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}
const typeSurface = JSON.parse(git(["show"
	, `${ownedCheckedRecordNativePerlPredecessor}:${typeSurfacePath}`]));
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
	, "The native/Perl milestone must refresh live source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, ownedCheckedRecordNativePerlImplementation, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [typeSurfacePath
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-checked-record-native-perl-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${ownedCheckedRecordNativePerlPredecessor}:${path}`]);
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
	assert.equal(reverseOwnedCheckedRecordNativePerlUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordNativePerlChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of ownedCheckedRecordNativePerlAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordNativePerlPredecessor, "--", path]).trim(), "", path);
		const currentSha256 = path === ownedCheckedRecordNativePerlEvidencePath
			? sha256(qualification) : sha256(await readFile(path));
		additions.push({ path, currentSha256 });
	}
	await writeFile(ownedCheckedRecordNativePerlHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "owned-checked-record-native-perl-source-v1"
			, predecessorCommit: ownedCheckedRecordNativePerlPredecessor
			, implementationCommit: ownedCheckedRecordNativePerlImplementation
			, acceptanceEvidence: {
				path: ownedCheckedRecordNativePerlEvidencePath
				, sha256: sha256(qualification)
			}
			, refreshedTypeSurfacePointers: pointerUpdates.length
			, pointerUpdates, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} native/Perl owned checked-record transitions, ${additions.length} additions, four local routes and ${pointerUpdates.length} refreshed pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
