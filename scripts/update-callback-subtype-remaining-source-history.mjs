#!/usr/bin/env node
/**
 * Record the exact .NET, JVM, native PHP and WIT callback Subtype transition.
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
	callbackSubtypeRemainingChangedPaths
	, callbackSubtypeRemainingHistoryPath
	, callbackSubtypeRemainingImplementation
	, callbackSubtypeRemainingPredecessor
	, reverseCallbackSubtypeRemainingUpdate
} from "../tests/helpers/callback-subtype-remaining-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeRemainingImplementation
	, "Remaining callback Subtype history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeRemainingHistoryPath]).trim(), ""
, "Never rewrite committed remaining callback Subtype history");

const addedPaths = Object.freeze([
	"scripts/update-callback-subtype-remaining-source-history.mjs"
	, "tests/helpers/callback-subtype-remaining-source-history.mjs"
	, "tests/helpers/callback-subtype-remaining-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";
const sourceTransitions = new Map();
for(const path of callbackSubtypeRemainingChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show", `${callbackSubtypeRemainingPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const typeSurface = JSON.parse(git(["show"
	, `${callbackSubtypeRemainingPredecessor}:${typeSurfacePath}`]));
let repaired = 0;
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const transition = sourceTransitions.get(file.path);
		if(transition && file.sha256 === transition.previous)
		{
			file.sha256 = transition.current; repaired++;
		}
	}

const evidenceId = "callback-subtype-remaining-generation";
assert.equal(typeSurface.evidence.some(item => item.id === evidenceId), false);
const evidencePaths = [
	"src/backends/dotnet/callable-graph-calls.mjs"
	, "src/backends/dotnet/callable-graph-model.mjs"
	, "src/backends/dotnet/callable-graph-runtime.mjs"
	, "src/backends/jvm/callable-graph-calls.mjs"
	, "src/backends/jvm/callable-graph-model.mjs"
	, "src/backends/jvm/callable-graph-runtime.mjs"
	, "src/backends/jvm/copied-graph-assets.mjs"
	, "src/backends/php/callable-graph-calls.mjs"
	, "src/backends/php/callable-graph-model.mjs"
	, "src/backends/php/callable-graph-runtime.mjs"
	, "src/backends/wit/callable-graph-host.mjs"
	, "src/backends/wit/callable-graph-session.mjs"
	, "src/backends/wit/callable-graph-typed.mjs"
	, "src/build/native-graph-projection.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
	, "tests/wit-recursive-callable-host.test.mjs"
];
typeSurface.evidence.push({
	id: evidenceId
	, kind: "test"
	, revision: callbackSubtypeRemainingImplementation
	, command: "node --test tests/native-recursive-callable-model.test.mjs tests/dotnet-recursive-callable-contract.test.mjs tests/jvm-recursive-callable-contract.test.mjs tests/php-recursive-callable-contract.test.mjs tests/wit-recursive-callable-package.test.mjs"
	, scope: ".NET, Java, Kotlin, native PHP and WIT generation retain host-versus-closure direction, require typed recovery for host callbacks returning selected Subtypes, omit host-only lease symbols and preserve constructor rejection as an ordinary boundary error. Exact local C#, Java/Kotlin and PHP source checks plus strict WIT C/C++ compilation found no generator defect. This entry does not claim source-free package installation or hosted release-floor acceptance."
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
		id: `callback-subtype-remaining-${route}`
		, profiles: ["dotnet", "java", "kotlin", "php-native", "wit-wasi"]
		, shapes: ["subtype"]
		, positions: ["callback-parameter", "callback-result"]
		, path
		, scope: "Generated synchronous copied-value callbacks carry exact typed recovery for checked host replies and validate checked returned-closure inputs. Host-only callbacks do not acquire public closure leases."
		, hostTypes: { subtype: {
			"callback-parameter": "base values checked by the selected constructor in returned-closure inputs"
			, "callback-result": "base values from a host callback checked by Lean with an explicit typed recovery"
		} }
		, conversionNotes: { subtype: ".NET and JVM use generated WithRecovery values; native PHP uses with_recovery(callback, value); WIT typed registration takes an owned copied recovery. Recovery is validated before application execution and is never successful output. Returned Lean closures validate selected Subtype inputs before invoking their body." }
		, stages: {
			analysis: stage("passed", `Fresh Lean analysis preserves the selected ${path} constructors and both callback directions.`)
			, generation: stage("passed", "Generated .NET, Java, Kotlin, native PHP and WIT APIs retain direction, checked payload types and exact recovery values without proof fields.")
			, compilation: stage("inspected", "Exact local source compilers found no generator defect; closed package matrices remain pending.")
			, packaging: stage("inspected", "Package generation and existing audit contracts pass, but no source-free selected-Subtype callback archive is claimed here.")
			, installedExecution: stage("inspected", "Installed ordinary and reviewed callback-Subtype consumers remain pending for these hosts.")
		}
		, limitations: [
			"The generated contract covers synchronous copied-value callbacks, the fixture's selected Nat Subtypes, admitted copied containers and returned closures. Retained or asynchronous host callbacks, checked-record callback positions, owned Subtypes, arbitrary predicates, recursive or generic refined callback payloads, dispatch cost and memory bounds remain separate work."
			, "Compilation, packaging and installed execution remain inspected rather than passed until source-free ordinary and reviewed packages execute through each public host API on the declared release floor."
		]
	});
}
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-remaining-history-"
));
const transition = async path => {
	const previous = git(["show", `${callbackSubtypeRemainingPredecessor}:${path}`]);
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
	assert.equal(reverseCallbackSubtypeRemainingUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeRemainingChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeRemainingPredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackSubtypeRemainingImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [
		"docs/consume/dotnet.md"
		, "docs/consume/java.md"
		, "docs/consume/kotlin.md"
		, "docs/consume/python.md"
		, "docs/consume/ruby.md"
		, "docs/consume/rust.md"
		, "docs/consume/wit-wasi.md"
		, "docs/php.md"
		, typeSurfacePath
		, "tests/helpers/callback-subtype-language-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/type-surface.test.mjs"].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-subtype-remaining-source-v1"
		, predecessorCommit: callbackSubtypeRemainingPredecessor
		, implementationCommit: callbackSubtypeRemainingImplementation
		, repairedTypeSurfacePointers: repaired
		, updates
		, additions
	};
	await writeFile(callbackSubtypeRemainingHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${repaired} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
