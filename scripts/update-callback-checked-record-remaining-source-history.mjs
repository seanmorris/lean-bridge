#!/usr/bin/env node
/**
 * Record the exact remaining-host callback checked-record transition and
 * reconcile only current type-surface pointers that name changed sources.
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
	callbackCheckedRecordRemainingChangedPaths
	, callbackCheckedRecordRemainingHistoryPath
	, callbackCheckedRecordRemainingImplementation
	, callbackCheckedRecordRemainingPredecessor
	, reverseCallbackCheckedRecordRemainingUpdate
} from "../tests/helpers/callback-checked-record-remaining-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackCheckedRecordRemainingImplementation
	, "Callback checked-record remaining history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, callbackCheckedRecordRemainingPredecessor
	, "Callback checked-record remaining lane must retain its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackCheckedRecordRemainingHistoryPath]).trim(), ""
, "Never rewrite committed callback checked-record remaining history");

const addedPaths = Object.freeze([
	".github/workflows/callback-checked-record-remaining.yml"
	, "scripts/check-callback-checked-record-remaining-ci.mjs"
	, "scripts/run-callback-checked-record-remaining-ci.sh"
	, "scripts/update-callback-checked-record-remaining-source-history.mjs"
	, "tests/callback-checked-record-remaining-installed.test.mjs"
	, "tests/fixtures/callback-checked-record-consumers/dotnet.cs"
	, "tests/fixtures/callback-checked-record-consumers/java.java"
	, "tests/fixtures/callback-checked-record-consumers/kotlin.kt"
	, "tests/fixtures/callback-checked-record-consumers/php-native.php"
	, "tests/fixtures/callback-checked-record-consumers/wit-wasi.c"
	, "tests/helpers/callback-checked-record-remaining-ci.mjs"
	, "tests/helpers/callback-checked-record-remaining-source-history.mjs"
	, "tests/helpers/callback-checked-record-remaining-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const historyPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
]);

const sourceTransitions = new Map();
for(const path of callbackCheckedRecordRemainingChangedPaths)
{
	if(path === typeSurfacePath || historyPaths.includes(path)) continue;
	const previous = git(["show", `${callbackCheckedRecordRemainingPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const typeSurface = JSON.parse(git(["show", `HEAD:${typeSurfacePath}`]));
let repaired = 0;
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const transition = sourceTransitions.get(file.path);
		if(transition && file.sha256 === transition.previous)
		{
			file.sha256 = transition.current;
			repaired++;
		}
	}

const evidenceId = "callback-checked-record-remaining-generation";
assert.equal(typeSurface.evidence.some(item => item.id === evidenceId), false);
const evidencePaths = [
	".github/workflows/callback-checked-record-remaining.yml"
	, "scripts/check-callback-checked-record-remaining-ci.mjs"
	, "scripts/run-callback-checked-record-remaining-ci.sh"
	, "src/backends/dotnet/callable-graph-package.mjs"
	, "src/backends/jvm/callable-graph-package.mjs"
	, "src/backends/php/callable-graph-package.mjs"
	, "src/backends/wit/callable-graph-package.mjs"
	, "src/build/native-graph-projection.mjs"
	, "tests/callback-checked-record-native-ci.test.mjs"
	, "tests/callback-checked-record-native.test.mjs"
	, "tests/callback-checked-record-remaining-installed.test.mjs"
	, "tests/helpers/callback-checked-record-remaining-ci.mjs"
	, "tests/helpers/callback-subtype-wit-install.mjs"
];
typeSurface.evidence.push({
	id: evidenceId, kind: "test"
	, revision: callbackCheckedRecordRemainingImplementation
	, command: "node --test tests/callback-checked-record-native.test.mjs tests/callback-checked-record-native-ci.test.mjs"
	, scope: "Source, generator and checker tests admit directional callback checked records for .NET, Java, Kotlin, native PHP and WIT/WASI. Local installed acceptance completed ordinary-source and independently reviewed packages in all five profiles: 30 checks in each managed or PHP consumer and 64 checks in WIT, with offline installation, author-source removal, relocation or runtime-only replay as appropriate. The required hosted Ubuntu 24.04/glibc 2.38 workflow remains pending, so this entry does not promote the observations into closed hosted acceptance."
	, files: await Promise.all(evidencePaths.map(async path => ({
		path, sha256: sha256(await readFile(path))
	})))
	, artifacts: []
});

const stage = (state, note) => ({ state, evidence: [evidenceId], note });
for(const route of ["ordinary", "reviewed"])
{
	const path = route === "ordinary" ? "ordinary-source" : "reviewed-ir";
	typeSurface.observations.push({
		id: `callback-checked-record-remaining-${route}`
		, profiles: ["dotnet", "java", "kotlin", "php-native", "wit-wasi"]
		, shapes: ["checked-record"]
		, positions: ["callback-parameter", "callback-result"]
		, path
		, scope: "Generated synchronous copied-value callbacks carry exact proof-free recovery records for checked-record host replies and validate checked-record returned-closure inputs. Nested checked fields run before their enclosing record constructor."
		, hostTypes: { "checked-record": {
			"callback-parameter": "generated proof-free record values checked by the selected constructor in returned-closure inputs"
			, "callback-result": "generated proof-free record values from a host callback checked by Lean through an explicit typed recovery"
		} }
		, conversionNotes: { "checked-record": ".NET and JVM use generated WithRecovery values; native PHP uses with_recovery(callback, value); WIT typed registration owns a copied recovery record. Recovery is checked before callback entry or application execution and is never successful output. Returned Lean closures apply the selected record and nested field constructors before their body." }
		, stages: {
			analysis: stage("passed", `Fresh Lean analysis preserves the selected ${path} record and nested field constructors in both callback directions.`)
			, generation: stage("passed", "Generated .NET, Java, Kotlin, native PHP and WIT APIs retain direction, nominal proof-free records and exact typed recovery values.")
			, compilation: stage("inspected", "Local C#, Java 22, Kotlin 2.2, PHP and strict WIT C compilation passed for both source routes; the hosted release-floor matrix remains pending.")
			, packaging: stage("inspected", "Local NuGet, Maven, Composer and WIT packages installed offline after author-source removal and passed their authenticated package checks.")
			, installedExecution: stage("inspected", "All ten local route/profile cells passed, including SDK-free .NET, jlink JVM, weak/strict relocated PHP and relocated source-free WIT replays; no hosted report is claimed yet.")
		}
		, limitations: [
			"The generated contract covers synchronous copied-value callbacks, Interval and Weighted records, the Weighted field's selected Nat Subtype, admitted option/result/array containers and returned closures. Retained or asynchronous host callbacks, owned checked records, arbitrary indexed or recursive checked records, dispatch cost and memory bounds remain separate work."
			, "Compilation, packaging and installed execution remain inspected rather than passed until the dedicated Ubuntu 24.04 workflow retains and independently checks the ordinary and reviewed reports at the glibc 2.38 package floor."
		]
	});
}
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-checked-record-remaining-history-"
));
const transition = async path => {
	const previous = git(["show", `${callbackCheckedRecordRemainingPredecessor}:${path}`]);
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
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reverseCallbackCheckedRecordRemainingUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackCheckedRecordRemainingChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackCheckedRecordRemainingPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const implemented = git(["diff", "--name-only"
		, callbackCheckedRecordRemainingPredecessor
		, callbackCheckedRecordRemainingImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(implemented, [
		...callbackCheckedRecordRemainingChangedPaths.filter(path =>
			path !== typeSurfacePath && !historyPaths.includes(path))
		, ...addedPaths.filter(path => !path.includes("source-history"))
	].sort());
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackCheckedRecordRemainingImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [typeSurfacePath, ...historyPaths].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-checked-record-remaining-source-v1"
		, predecessorCommit: callbackCheckedRecordRemainingPredecessor
		, implementationCommit: callbackCheckedRecordRemainingImplementation
		, repairedTypeSurfacePointers: repaired
		, scope: "Checked records cross synchronous copied callbacks and returned Lean closures in .NET, Java, Kotlin, native PHP and WIT/WASI through nominal proof-free values, exact typed recovery, selected nested constructors, source-free offline installations and independently checked ordinary-source and reviewed-IR evidence paths."
		, updates, additions
	};
	await writeFile(callbackCheckedRecordRemainingHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${repaired} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
