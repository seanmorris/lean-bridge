#!/usr/bin/env node
/**
 * Promote exactly the remaining 45 installed generic-signature cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	signatureSpecializationBrowserProfiles
	, signatureSpecializationCompletionEvidenceId
	, signatureSpecializationCompletionPinBaseline
	, signatureSpecializationCompletionReference
	, signatureSpecializationCompletionTargetCells
	, signatureSpecializationNativeProfiles
	, signatureSpecializationShapes
} from "../tests/helpers/signature-specialization-completion-promotion.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: promote-signature-specialization-completion.mjs");
for(const arguments_ of [
	["diff", "--quiet", "HEAD", "--"]
	, ["diff", "--cached", "--quiet", "HEAD", "--"]
]) assert.doesNotThrow(() => execFileSync("git", arguments_
	, { stdio: "ignore" }), "Signature promotion requires a clean tracked tree");
assert.doesNotThrow(() => execFileSync("git", [
	"merge-base", "--is-ancestor"
	, signatureSpecializationCompletionPinBaseline, "HEAD"
], { stdio: "ignore" }), "Signature pin baseline is not an ancestor of HEAD");
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
assert.equal(git(["diff", "--name-status", "--find-renames"
	, "--diff-filter=RD", signatureSpecializationCompletionPinBaseline
	, "HEAD", "--"]).trim(), ""
, "Signature promotion refuses renamed or deleted baseline paths");
const path = "docs/type-surface.v1.json";
const [inventory, irSchema, consumers] = await Promise.all([
	path, "schema/binding-ir.schema.json", "docs/consumer-support.v1.json"
].map(async file => JSON.parse(await readFile(file, "utf8"))));
const contracts = { irSchema, consumers };
const reference = await signatureSpecializationCompletionReference();
assert.ok(!inventory.evidence.some(item =>
	item.id === signatureSpecializationCompletionEvidenceId));
inventory.evidence.push({
	id: signatureSpecializationCompletionEvidenceId, kind: "installed"
	, revision: reference.index.archiveCommit
	, command: "node --test --test-concurrency=1 tests/signature-specialization-hosted-evidence.test.mjs"
	, scope: "Ten hosted lanes execute independently reviewed generic, implicit and instance signatures through nine native-language profiles; ordinary instance and all reviewed signatures through pages, React lifecycles and dedicated workers in Chromium, Firefox and WebKit; and all ordinary and reviewed signatures through twelve PHP-Wasm installation, loading and caller arrangements. The immutable archive binds every lane to its exact successful producer and retains complete original artifact ZIPs, API identities, job logs, reports and selected source closures."
	, files: reference.files
	, artifacts: reference.artifacts.map(artifact => ({
		...artifact
		, path: `${signatureSpecializationCompletionEvidenceId}/${artifact.path}`
	}))
});

const groups = [
	{
		id: "signature-completion-native-reviewed"
		, profiles: signatureSpecializationNativeProfiles
		, shapes: signatureSpecializationShapes, path: "reviewed-ir"
		, scope: "Independently reviewed installed packages execute generic, implicit and instance signatures through Python, Ruby, Rust, .NET, Java, Kotlin, native PHP, WIT/WASI and four pinned Perl ABIs."
	}
	, {
		id: "signature-completion-browser-instance-ordinary"
		, profiles: signatureSpecializationBrowserProfiles
		, shapes: ["instance"], path: "ordinary-source"
		, scope: "Ordinary-source installed packages execute instance-dictionary signatures through pages, React production and Strict Mode lifecycles, and dedicated workers in Chromium, Firefox and WebKit."
	}
	, {
		id: "signature-completion-browser-reviewed"
		, profiles: signatureSpecializationBrowserProfiles
		, shapes: signatureSpecializationShapes, path: "reviewed-ir"
		, scope: "Independently reviewed installed packages execute generic, implicit and instance signatures through every declared browser context and engine."
	}
	, ...["ordinary-source", "reviewed-ir"].map(sourcePath => ({
		id: `signature-completion-php-wasm-${sourcePath}`
		, profiles: ["php-wasm"], shapes: signatureSpecializationShapes
		, path: sourcePath
		, scope: `${sourcePath === "ordinary-source"
			? "Ordinary-source" : "Independently reviewed"} installed packages execute generic, implicit and instance signatures through embedded and Composer Node hosts plus bundled Chromium, with eager/lazy loading and weak/strict callers.`
	}))
];
assert.equal(groups.length, 5);
const targets = groups.flatMap(group => group.profiles.flatMap(profile =>
	group.shapes.map(shape => `${profile}/${shape}/${group.path}/signature`)));
assert.equal(targets.length, 45);
assert.deepEqual([...targets].sort()
	, [...signatureSpecializationCompletionTargetCells].sort());
const beforeCells = typeSurfaceCells(inventory, contracts);
const before = new Map(beforeCells.map(cell => [cell.id, cell]));
for(const id of targets)
	assert.notEqual(before.get(id)?.stages.installedExecution.state
		, "passed", id);

const stageNotes = {
	analysis: "Lean elaborates each configured type, implicit argument or instance dictionary and records the exact closed specialization."
	, generation: "The selected package exposes concrete functions and omits the unspecialized declaration; no runtime type argument crosses the boundary."
	, compilation: "The chosen generic body and dictionary operations compile into the target package using the independently reviewed specialization decisions."
	, packaging: "Two builds reproduce source-free archives that install offline after author roots, build roots and handoff inputs are removed."
	, installedExecution: "Hosted installed consumers execute the exact selected signatures, values and dictionaries across the archive's language, runtime, browser and loading matrix."
};
const hostTypes = {
	generic: { signature: "A concrete exported function over the selected named record, List or Option specialization" }
	, implicit: { signature: "A concrete exported host signature whose implicit Lean type argument was fixed before compilation" }
	, instance: { signature: "A concrete exported function whose selected type-class dictionary is compiled into the specialization" }
};
for(const group of groups)
	inventory.observations.push({
		id: group.id, profiles: group.profiles, shapes: group.shapes
		, positions: ["signature"], path: group.path, scope: group.scope
		, hostTypes: Object.fromEntries(group.shapes.map(shape => [
			shape, hostTypes[shape]
		]))
		, stages: Object.fromEntries(inventory.stages.map(stage => [stage, {
			state: "passed", evidence: [signatureSpecializationCompletionEvidenceId]
			, note: stageNotes[stage]
		}]))
		, limitations: [
			"Only the named closed specialization shapes, signature position, source route and installed profiles are established by this observation."
			, "Open generic dispatch, dependent or indexed specialization, recursive generic payloads, dispatch cost and peak memory remain separate."
			, ...reference.index.limitations
		]
		, conversionNotes: Object.fromEntries(group.shapes.map(shape => [
			shape
			, shape === "instance"
				? "Call the concrete export normally; the configured dictionary is already selected and no dictionary token crosses the host boundary."
				: "Call the concrete export with its selected value; Lean fixes the configured type before compilation and no runtime type token crosses the host boundary."
		]))
	});
const changedPaths = git(["diff", "--name-only", "--diff-filter=AM"
	, signatureSpecializationCompletionPinBaseline, "HEAD", "--"])
	.trim().split("\n").filter(Boolean);
const currentSourcePaths
	= dependentCheckedRecordPromotionCurrentSourcePaths(
		inventory, changedPaths);
const currentDigests = new Map();
for(const changedPath of currentSourcePaths)

{
	let bytes;
	try
	{ bytes = await readFile(changedPath); }
	catch(error)
	{
		if(error?.code !== "ENOENT") throw error;
		bytes = execFileSync("git", ["show", `HEAD:${changedPath}`], {
			maxBuffer: 512 * 1024 * 1024
		});
	}
	currentDigests.set(changedPath, sha256(bytes));
}
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, currentDigests);
assert.ok(reconciled.refreshed > 0
	, "Signature promotion must reconcile changed current-source pins");

const afterCells = typeSurfaceCells(reconciled.inventory, contracts);
const changed = afterCells.filter(cell => JSON.stringify(cell.stages)
	!== JSON.stringify(before.get(cell.id).stages));
assert.deepEqual(changed.map(cell => cell.id).sort(), [...targets].sort());
for(const cell of changed)
	for(const stage of Object.values(cell.stages))
		assert.equal(stage.state, "passed", cell.id);
await writeFile(path, JSON.stringify(reconciled.inventory, null, 2) + "\n");
process.stdout.write("Promoted one immutable ten-lane archive through five observations and exactly 45 signature cells; reconciled "
	+ `${reconciled.refreshed} current-source pins.\n`);
