#!/usr/bin/env node
/**
 * Record the exact Python, Ruby and Rust callback Subtype transition and
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
	callbackSubtypeLanguageChangedPaths
	, callbackSubtypeLanguageHistoryPath
	, callbackSubtypeLanguageImplementation
	, callbackSubtypeLanguagePredecessor
	, reverseCallbackSubtypeLanguageUpdate
} from "../tests/helpers/callback-subtype-language-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeLanguageImplementation
	, "Callback Subtype language history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeLanguageHistoryPath]).trim(), ""
, "Never rewrite committed callback Subtype language history");

const addedPaths = Object.freeze([
	".github/workflows/callback-subtype-languages.yml"
	, "scripts/check-callback-subtype-languages-ci.mjs"
	, "scripts/run-callback-subtype-languages-ci.sh"
	, "scripts/update-callback-subtype-language-source-history.mjs"
	, "tests/callback-subtype-language-installed.test.mjs"
	, "tests/fixtures/callback-subtype-consumers/python.py"
	, "tests/fixtures/callback-subtype-consumers/ruby.rb"
	, "tests/fixtures/callback-subtype-consumers/rust.rs"
	, "tests/helpers/callback-subtype-language-source-history.mjs"
	, "tests/helpers/callback-subtype-language-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";

const sourceTransitions = new Map();
for(const path of callbackSubtypeLanguageChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show", `${callbackSubtypeLanguagePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const typeSurface = JSON.parse(git(["show"
	, `${callbackSubtypeLanguagePredecessor}:${typeSurfacePath}`]));
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

const evidenceId = "callback-subtype-languages-generation";
assert.equal(typeSurface.evidence.some(item => item.id === evidenceId), false);
const evidencePaths = [
	".github/workflows/callback-subtype-languages.yml"
	, "src/backends/python/callable-graph-conversions.mjs"
	, "src/backends/python/callable-graph-package.mjs"
	, "src/backends/ruby/callable-graph-conversions.mjs"
	, "src/backends/ruby/callable-graph-package.mjs"
	, "src/backends/rust/callable-graph-conversions.mjs"
	, "src/backends/rust/callable-graph-package.mjs"
	, "src/build/native-graph-projection.mjs"
	, "tests/callback-subtype-language-installed.test.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
];
typeSurface.evidence.push({
	id: evidenceId
	, kind: "test"
	, revision: callbackSubtypeLanguageImplementation
	, command: "node --test tests/native-recursive-callable-model.test.mjs tests/callback-subtype-native-ci.test.mjs"
	, scope: "Source and generator checks admit directional callback Subtypes for Python, Ruby and Rust, retain host-versus-closure direction, emit typed recovery APIs, omit host-only lease symbols and preserve constructor rejection as an ordinary boundary error. Local installed spot checks reached both Ruby and Rust author routes and an Ubuntu 24.04 Python wheel, but this entry does not promote those observations into closed installed acceptance. The dedicated hosted workflow must retain one complete six-cell report before installed support is claimed."
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
		id: `callback-subtype-languages-${route}`
		, profiles: ["python", "ruby", "rust"]
		, shapes: ["subtype"]
		, positions: ["callback-parameter", "callback-result"]
		, path
		, scope: "Generated synchronous copied-value callbacks carry exact typed recovery for checked host replies and validate checked returned-closure inputs. Host-only callbacks do not acquire a public closure lease."
		, hostTypes: { subtype: {
			"callback-parameter": "base values checked by the selected constructor in returned-closure inputs"
			, "callback-result": "base values from a host callback checked by Lean through with_recovery(callback, value)"
		} }
		, conversionNotes: { subtype: "Python, Ruby and Rust require with_recovery(callback, value) for host callbacks returning selected Subtypes. Recovery is validated before callback entry and is never successful output. Returned Lean closures validate selected Subtype inputs before invoking their body." }
		, stages: {
			analysis: stage("passed", `Fresh Lean analysis preserves the selected ${path} constructors and both callback directions.`)
			, generation: stage("passed", "Generated Python, Ruby and Rust APIs retain direction, checked payload types and exact recovery values without proof fields.")
			, compilation: stage("inspected", "Local package compilation found no generator defect, but the closed hosted matrix remains pending.")
			, packaging: stage("inspected", "Prepared wheels, gems and crates were spot-checked locally; complete hosted package records remain pending.")
			, installedExecution: stage("inspected", "Local language consumers exercised the transition, but no complete retained six-cell hosted report is claimed here.")
		}
		, limitations: [
			"The generated contract covers synchronous copied-value callbacks, the fixture's selected Nat Subtypes, admitted copied containers and returned closures. Retained or asynchronous host callbacks, checked-record callback positions, owned Subtypes, arbitrary predicates, recursive or generic refined callback payloads, dispatch cost and memory bounds remain separate work."
			, "Compilation, packaging and installed execution remain inspected rather than passed until the dedicated Ubuntu 24.04 workflow retains and independently checks ordinary and reviewed Python, Ruby and Rust reports."
		]
	});
}
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-languages-history-"
));
const transition = async path => {
	const previous = git(["show", `${callbackSubtypeLanguagePredecessor}:${path}`]);
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
	assert.equal(reverseCallbackSubtypeLanguageUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeLanguageChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeLanguagePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackSubtypeLanguageImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [typeSurfacePath
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/type-surface.test.mjs"].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-subtype-languages-source-v1"
		, predecessorCommit: callbackSubtypeLanguagePredecessor
		, implementationCommit: callbackSubtypeLanguageImplementation
		, repairedTypeSurfacePointers: repaired
		, updates
		, additions
	};
	await writeFile(callbackSubtypeLanguageHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${repaired} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
