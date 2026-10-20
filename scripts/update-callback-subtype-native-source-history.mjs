#!/usr/bin/env node
/**
 * Record the exact C/C++/Perl callback Subtype transition and repair only the
 * current-source pointers that name its changed files.
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
	callbackSubtypeNativeChangedPaths
	, callbackSubtypeNativeHistoryPath
	, callbackSubtypeNativeImplementation
	, callbackSubtypeNativePredecessor
	, reverseCallbackSubtypeNativeUpdate
} from "../tests/helpers/callback-subtype-native-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeNativeImplementation
	, "Callback Subtype native history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeNativeHistoryPath]).trim(), ""
, "Never rewrite committed callback Subtype native history");

const addedPaths = Object.freeze([
	".github/workflows/callback-subtype-native.yml"
	, ".github/workflows/callback-subtype-perl.yml"
	, "docs/evidence/callback-subtype-native-20261020/native.json"
	, "docs/evidence/callback-subtype-native-20261020/perl.json"
	, "docs/evidence/callback-subtype-native-20261020/receipt.json"
	, "docs/evidence/callback-subtype-native-acceptance-20261020.md"
	, "scripts/archive-callback-subtype-native-local.mjs"
	, "scripts/check-callback-subtype-native-ci.mjs"
	, "scripts/check-callback-subtype-perl-ci.mjs"
	, "scripts/run-callback-subtype-native-ci.sh"
	, "scripts/run-callback-subtype-perl-ci.sh"
	, "scripts/update-callback-subtype-native-source-history.mjs"
	, "tests/callback-subtype-native-ci.test.mjs"
	, "tests/callback-subtype-native-installed.test.mjs"
	, "tests/callback-subtype-perl-installed.test.mjs"
	, "tests/fixtures/callback-subtype-consumers/c.c"
	, "tests/fixtures/callback-subtype-consumers/cpp.cpp"
	, "tests/fixtures/callback-subtype-consumers/perl.pl"
	, "tests/helpers/callback-subtype-native-ci.mjs"
	, "tests/helpers/callback-subtype-native-source-history.mjs"
	, "tests/helpers/callback-subtype-native-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurfaceSources = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/perl.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/publish/cpan.md"
	, "src/backends/c/callable-graph-model.mjs"
	, "src/backends/c/callable-graph-package.mjs"
	, "src/backends/c/native-callable-graph-borrows.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "src/backends/cpp/callable-graph-package.mjs"
	, "src/backends/perl/callable-graph-model.mjs"
	, "src/backends/perl/callable-graph-package.mjs"
	, "src/backends/perl/callable-graph-xs.mjs"
	, "src/build/native-callable-graph.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/native-graph-projection.mjs"
	, "src/release/native-c-family.mjs"
	, "tests/c-recursive-callable-package.test.mjs"
	, "tests/cpp-recursive-callable-package.test.mjs"
	, "tests/helpers/structured-callable-fixture.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
	, "tests/perl-recursive-callable-contract.test.mjs"
	, "tests/type-surface.test.mjs"
]);

const sourceTransitions = new Map();
for(const path of callbackSubtypeNativeChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show", `${callbackSubtypeNativePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const baselineTypeSurface = git(["show", `HEAD:${typeSurfacePath}`]);
const typeSurface = JSON.parse(baselineTypeSurface);
let repaired = 0;
for(const sourcePath of typeSurfaceSources)
{
	const transition = sourceTransitions.get(sourcePath);
	assert.ok(transition, sourcePath);
	let count = 0;
	for(const evidence of typeSurface.evidence)
		for(const file of evidence.files)
			if(file.path === sourcePath && file.sha256 === transition.previous)
			{
				file.sha256 = transition.current; count++; repaired++;
			}
	assert.ok(count > 0, `${typeSurfacePath}: ${sourcePath}`);
}
const repairedTypeSurface = JSON.stringify(typeSurface, null, 2) + "\n";
const existingTypeSurface = await readFile(typeSurfacePath, "utf8");

const evidenceFiles = async paths => Promise.all(paths.map(async path => ({
	path, sha256: sha256(await readFile(path))
})));
const nativeEvidence = "callback-subtype-native-local-installed";
const perlEvidence = "callback-subtype-perl-local-installed";
typeSurface.evidence.push({
	id: nativeEvidence
	, kind: "installed"
	, revision: callbackSubtypeNativeImplementation
	, command: "LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_PROFILES=c,cpp node --test tests/callback-subtype-native-installed.test.mjs"
	, scope: "Ordinary-source and reviewed-IR packages install offline after author-source removal. Unchanged C11/GMP and C++20 callers run from the installed compiler-free path. Four reports cover both source routes and both profiles: C completes 16 checks per route and C++ completes 13. Host callback Subtype results use exact typed recovery, returned Lean closures check Subtype inputs before their bodies run, rejection preserves caller values, and later calls recover. This is local Linux x64/glibc 2.36 acceptance; package bytes and terminal TAP were not retained, so hosted release-floor acceptance remains separate."
	, files: await evidenceFiles([
		"docs/evidence/callback-subtype-native-acceptance-20261020.md"
		, "docs/evidence/callback-subtype-native-20261020/receipt.json"
		, "tests/callback-subtype-native-installed.test.mjs"
		, "tests/helpers/callback-subtype-native-ci.mjs"
		, ".github/workflows/callback-subtype-native.yml"
	])
	, artifacts: [{
		path: "callback-subtype-native-local/native.json"
		, sha256: "31d541c019fd1589c82c2e198144b017b124b4ca9a58c9568fb5500a4921d18f"
	}]
});
typeSurface.evidence.push({
	id: perlEvidence
	, kind: "installed"
	, revision: callbackSubtypeNativeImplementation
	, command: "LEAN_BRIDGE_CALLBACK_SUBTYPE_PERL_TEST=1 node --test tests/callback-subtype-perl-installed.test.mjs"
	, scope: "Ordinary-source and reviewed-IR component/runtime CPAN archives install after author-source removal and replay after relocation on threaded and unthreaded Perl 5.36.3 and 5.38.2 in prebuilt-only and build-XS modes. All 16 cells complete 34 checks, five successful calls and six expected rejections. Host callback Subtype results require Runtime::Callback with an exact checked recovery; returned Lean closures check inputs before their bodies run and remain usable after rejection. This is local Linux x64/glibc 2.36 acceptance. Original machine-readable reports and exact archive identities are retained, but package bytes and terminal TAP were not; hosted release-floor acceptance remains separate."
	, files: await evidenceFiles([
		"docs/evidence/callback-subtype-native-acceptance-20261020.md"
		, "docs/evidence/callback-subtype-native-20261020/receipt.json"
		, "tests/callback-subtype-perl-installed.test.mjs"
		, "tests/helpers/callback-subtype-native-ci.mjs"
		, ".github/workflows/callback-subtype-perl.yml"
	])
	, artifacts: [
		{ path: "callback-subtype-perl-local/perl.json", sha256: "8c41f0f48e36f0293e1e85e40b98d246879c7e02214f1449471d49bb5bd0ed4a" }
		, { path: "callback-subtype-perl-local/ordinary/LeanBridge-CallbackSubtypes-1.000.tar.gz", sha256: "58cd40016c5314e4bd891bcf8253b97875572e918965c0f55a924136a79feeb0" }
		, { path: "callback-subtype-perl-local/reviewed/LeanBridge-CallbackSubtypes-1.000.tar.gz", sha256: "83ed034d59cfc0259d5c87051ef17b394f2edc643c277cd1de59dc1333f6b576" }
		, { path: "callback-subtype-perl-local/LeanBridge-Runtime.tar.gz", sha256: "3bb112e3e6904d1ad757f78b5aa3957f1c8068db472dc508c418663ec1439e76" }
	]
});

const stages = (evidence, route, host) => ({
	analysis: { state: "passed", evidence: [evidence]
		, note: `Fresh Lean analysis preserves the selected ${route} constructors for both callback directions in ${host}.` }
	, generation: { state: "passed", evidence: [evidence]
		, note: `Generated ${host} callback descriptors expose exact checked inputs, results and typed recovery without proof fields.` }
	, compilation: { state: "passed", evidence: [evidence]
		, note: `Compiled Lean constructs each present callback Subtype value before source execution and projects proof-backed values.` }
	, packaging: { state: "passed", evidence: [evidence]
		, note: `The ${route} package installs after author-source removal and executes through its installed consumer API.` }
	, installedExecution: { state: "passed", evidence: [evidence]
		, note: `Installed ${host} callers check acceptance, exact rejection, caller-value preservation and recovery on the ${route} route.` }
});
const limitations = [
	"Acceptance covers the fixture's Nat Subtypes in synchronous host callbacks and returned Lean closures on Linux x64/glibc 2.36. Asynchronous or retained host callbacks, arbitrary predicates, recursive or generic refined callback payloads, other native systems, dispatch cost and memory bounds remain separate work."
	, "The local reports are retained, but package bytes and local terminal TAP are not. Dedicated workflows retain original TAP and reports for hosted runs; hosted release-floor acceptance is not claimed by this local evidence."
];
for(const route of ["ordinary", "reviewed"])
{
	const path = route === "ordinary" ? "ordinary-source" : "reviewed-ir";
	typeSurface.observations.push({
		id: `callback-subtype-native-${route}`
		, profiles: ["c", "cpp"]
		, shapes: ["subtype"]
		, positions: ["callback-parameter", "callback-result"]
		, path
		, scope: "Checked inputs to returned Lean closures and checked results produced by host callbacks. Host-only callbacks do not acquire a public closure API. C descriptors and C++ wrappers carry an exact typed recovery for host-produced checked results."
		, hostTypes: { subtype: {
			"callback-parameter": "base values checked by the selected constructor in returned-closure inputs"
			, "callback-result": "base values from a host callback checked by Lean with an explicit typed recovery"
		} }
		, conversionNotes: { subtype: "Host callback results require the generated typed recovery descriptor in C or with_recovery in C++; the recovery is checked before invocation and is never successful output. Returned Lean closures validate selected Subtype inputs before invoking their body." }
		, stages: stages(nativeEvidence, path, "C/C++")
		, limitations
	});
	typeSurface.observations.push({
		id: `callback-subtype-perl-${route}`
		, profiles: ["perl"]
		, shapes: ["subtype"]
		, positions: ["callback-parameter", "callback-result"]
		, path
		, scope: "Checked inputs to returned Lean closures and checked results produced by host callbacks on all four prepared Perl ABIs and both delivery modes. Host-only callbacks do not acquire a public closure type."
		, hostTypes: { subtype: {
			"callback-parameter": "base values checked by the selected constructor in returned-closure inputs"
			, "callback-result": "base values from a host callback checked by Lean with an explicit Runtime::Callback recovery"
		} }
		, conversionNotes: { subtype: "Use Runtime::Callback->new(code => $callback, recovery => $value) for a host callback with a checked result. Lean checks the recovery before the callback can run and checks every returned value; the recovery is never successful output. Returned Lean closures validate checked inputs before invoking their body." }
		, stages: stages(perlEvidence, path, "Perl")
		, limitations
	});
}
const currentTypeSurface = JSON.stringify(typeSurface, null, 2) + "\n";
const withoutEvidenceHashes = source => {
	const document = JSON.parse(source);
	for(const evidence of document.evidence)
		for(const file of evidence.files) file.sha256 = "0".repeat(64);
	return JSON.stringify(document);
};
assert.ok(existingTypeSurface === baselineTypeSurface
	|| existingTypeSurface === repairedTypeSurface
	|| existingTypeSurface === currentTypeSurface
	|| withoutEvidenceHashes(existingTypeSurface)
		=== withoutEvidenceHashes(currentTypeSurface)
, `${typeSurfacePath} is neither the implementation baseline nor an exact generated state`);
if(existingTypeSurface !== currentTypeSurface)
	await writeFile(typeSurfacePath, currentTypeSurface);

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-native-history-"
));
const transition = async path => {
	const previous = git(["show", `${callbackSubtypeNativePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
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
	assert.equal(reverseCallbackSubtypeNativeUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeNativeChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeNativePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackSubtypeNativeImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [typeSurfacePath
		, "docs/consume/c.md"
		, "docs/consume/cpp.md"
		, "docs/consume/perl.md"
		, "tests/fixtures/callback-subtype-consumers/types.mts"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/type-surface.test.mjs"].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-subtype-native-source-v1"
		, predecessorCommit: callbackSubtypeNativePredecessor
		, implementationCommit: callbackSubtypeNativeImplementation
		, repairedTypeSurfacePointers: repaired
		, updates
		, additions
	};
	await writeFile(callbackSubtypeNativeHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${repaired} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
