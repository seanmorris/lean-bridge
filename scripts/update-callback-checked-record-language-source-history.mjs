#!/usr/bin/env node
/**
 * Record the exact Python, Ruby and Rust callback checked-record transition and
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
	callbackCheckedRecordLanguageChangedPaths
	, callbackCheckedRecordLanguageHistoryPath
	, callbackCheckedRecordLanguageImplementation
	, callbackCheckedRecordLanguagePredecessor
	, reverseCallbackCheckedRecordLanguageUpdate
} from "../tests/helpers/callback-checked-record-language-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackCheckedRecordLanguageImplementation
	, "Callback checked-record language history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackCheckedRecordLanguageHistoryPath]).trim(), ""
, "Never rewrite committed callback checked-record language history");

const addedPaths = Object.freeze([
	".github/workflows/callback-checked-record-languages.yml"
	, "scripts/check-callback-checked-record-languages-ci.mjs"
	, "scripts/run-callback-checked-record-languages-ci.sh"
	, "scripts/update-callback-checked-record-language-source-history.mjs"
	, "tests/callback-checked-record-language-installed.test.mjs"
	, "tests/fixtures/callback-checked-record-consumers/python.py"
	, "tests/fixtures/callback-checked-record-consumers/ruby.rb"
	, "tests/fixtures/callback-checked-record-consumers/rust.rs"
	, "tests/helpers/callback-checked-record-language-source-history.mjs"
	, "tests/helpers/callback-checked-record-language-source-history-tests.mjs"
]);
const typeSurfacePath = "docs/type-surface.v1.json";

const sourceTransitions = new Map();
for(const path of callbackCheckedRecordLanguageChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show", `${callbackCheckedRecordLanguagePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const typeSurface = JSON.parse(git(["show"
	, `${callbackCheckedRecordLanguagePredecessor}:${typeSurfacePath}`]));
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

const evidenceId = "callback-checked-record-languages-generation";
assert.equal(typeSurface.evidence.some(item => item.id === evidenceId), false);
const evidencePaths = [
	".github/workflows/callback-checked-record-languages.yml"
	, "src/backends/python/callable-graph-package.mjs"
	, "src/backends/ruby/callable-graph-package.mjs"
	, "src/backends/rust/callable-graph-package.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-graph-projection.mjs"
	, "tests/callback-checked-record-language-installed.test.mjs"
	, "tests/callback-checked-record-native-ci.test.mjs"
	, "tests/callback-checked-record-native.test.mjs"
];
typeSurface.evidence.push({
	id: evidenceId
	, kind: "test"
	, revision: callbackCheckedRecordLanguageImplementation
	, command: "node --test tests/callback-checked-record-native.test.mjs tests/callback-checked-record-native-ci.test.mjs"
	, scope: "Source and generator checks admit directional callback checked records for Python, Ruby and Rust, distinguish their constructor-owned field checks from raw callback Fin, retain host-versus-closure direction and emit typed recovery APIs. Local installed acceptance completed both Ruby and Rust author routes; an extracted Python wheel completed its 26 runtime checks, while pip installation awaits the dedicated Ubuntu 24.04/glibc 2.38 workflow. This entry does not promote those observations into closed installed acceptance."
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
		id: `callback-checked-record-languages-${route}`
		, profiles: ["python", "ruby", "rust"]
		, shapes: ["checked-record"]
		, positions: ["callback-parameter", "callback-result"]
		, path
		, scope: "Generated synchronous copied-value callbacks carry exact typed recovery for checked-record host replies and validate checked-record returned-closure inputs. Proof fields never cross the host boundary."
		, hostTypes: { "checked-record": {
			"callback-parameter": "generated proof-free record values checked by the selected constructor in returned-closure inputs"
			, "callback-result": "generated proof-free record values from a host callback checked by Lean through with_recovery(callback, value)"
		} }
		, conversionNotes: { "checked-record": "Python, Ruby and Rust require with_recovery(callback, value) for host callbacks returning checked records. Recovery is validated before callback entry and is never successful output. Lean-produced callback arguments carry only record payload fields; returned Lean closures apply the selected record and nested field constructors before their body." }
		, stages: {
			analysis: stage("passed", `Fresh Lean analysis preserves the selected ${path} record and nested field constructors in both callback directions.`)
			, generation: stage("passed", "Generated Python, Ruby and Rust APIs retain direction, proof-free record types and exact recovery values.")
			, compilation: stage("inspected", "Local Ruby and Rust packages compiled in both routes and the Python package compiled; the closed hosted matrix remains pending.")
			, packaging: stage("inspected", "Prepared gems and crates installed locally; the Python wheel was inspected and executed after extraction because this host is below its glibc 2.38 tag.")
			, installedExecution: stage("inspected", "Ruby and Rust completed both source routes and extracted Python completed 26 checks, but no complete retained six-cell hosted report is claimed here.")
		}
		, limitations: [
			"The generated contract covers synchronous copied-value callbacks, the fixture's Interval and Weighted records, the Weighted field's selected Nat Subtype, admitted option/result/array containers and returned closures. Retained or asynchronous host callbacks, owned checked records, arbitrary indexed records, dispatch cost and memory bounds remain separate work."
			, "Compilation, packaging and installed execution remain inspected rather than passed until the dedicated Ubuntu 24.04 workflow retains and independently checks ordinary and reviewed Python, Ruby and Rust reports."
		]
	});
}
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-checked-record-languages-history-"
));
const transition = async path => {
	const previous = git(["show", `${callbackCheckedRecordLanguagePredecessor}:${path}`]);
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
	assert.equal(reverseCallbackCheckedRecordLanguageUpdate(current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackCheckedRecordLanguageChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackCheckedRecordLanguagePredecessor, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackCheckedRecordLanguageImplementation, "--"])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified, [typeSurfacePath
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/type-surface.test.mjs"].sort());
	const record = {
		schemaVersion: 1
		, milestone: "callback-checked-record-languages-source-v1"
		, predecessorCommit: callbackCheckedRecordLanguagePredecessor
		, implementationCommit: callbackCheckedRecordLanguageImplementation
		, repairedTypeSurfacePointers: repaired
		, updates
		, additions
	};
	await writeFile(callbackCheckedRecordLanguageHistoryPath
		, canonicalJson(record), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates, ${additions.length} additions and ${repaired} type-surface pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
