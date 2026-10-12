/**
 * Tie Rust nominal support to four original source-free installed Rust selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeRustOriginal, nominalSubtypeRustGenerator } from "./nominal-subtype-rust-generators.mjs";
import { checkNominalSubtypeRustReport, nominalSubtypeRustRecords } from "./nominal-subtype-rust-report.mjs";
import { assertNominalSubtypeRustRun, nominalSubtypeRustSelections } from "./nominal-subtype-rust-provenance.mjs";

export const nominalSubtypeRustArchive = "docs/evidence/nominal-subtype-rust-20261012";
export const nominalSubtypeRustIndexSha256 = "8fc801f8f1e6e1af7c4e6844ded44a46b700702b11ba979071cef0b194ae5495";
export const nominalSubtypeRustProfiles = ["rust"];
export const nominalSubtypeRustHostSuffix = "; also in tested acyclic records and variants";
export const nominalSubtypeRustConversion = "In Rust, the tested acyclic records and variants use generated structs and enums with exact BigUint payloads for Nat Subtypes. Input functions borrow the generated values. Each input site keeps its selected checked constructor, including distinct normalizing choices for the same record. Copied results project existing Lean values without selecting or running an input constructor. Callers supply no proof fields.";
export const nominalSubtypeRustLimit = "Nominal acceptance covers the tested Nat Subtype records, variants, aliases and copied constructor-free results with Rust and Cargo 1.90.0 through offline crate installation on Linux x64/glibc 2.36 with an explicit 2.36 package floor. Consumers run after relocation and again after removal of all consumer sources. Other primitive-base nominal fixtures and other hosts need separate acceptance. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending. Constructor/source entry counts and memory are unmeasured; these local runs do not establish hosted release-floor acceptance. The repository archive omits package binaries and full toolchains; receipts, installed-file hashes and selected source snapshots are retained.";
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate the original source closure and the pinned Rust and Cargo toolchain.
 *
 * @param read - Reader of repository-relative original archive files.
 */
export const nominalSubtypeRustReferences = async (read = readFile) => {
	const bytes = await read(`${nominalSubtypeRustArchive}/index.json`);
	assert.equal(sha256(bytes), nominalSubtypeRustIndexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-subtype-rust-installed-v1");
	assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalSubtypeRustSelections);
	for(const entry of index.files)
	{
		assert.ok(!files.has(entry.path));
		const value = await read(`${nominalSubtypeRustArchive}/${entry.path}`);
		assert.equal(value.length, entry.bytes); assert.equal(sha256(value), entry.sha256);
		files.set(entry.path, value);
	}
	for(const path of index.selectedSources)
		assert.deepEqual(files.get(`sources/${path}`), nominalSubtypeRustOriginal(index.producerCommit, path));
	assert.deepEqual(index.generatorClosure, (await nominalSubtypeRustGenerator(index.producerCommit)).paths);
	const references = [];
	for(const run of index.runs)
	{
		assert.equal(run.producerCommit, index.producerCommit); assert.equal(run.label, `${run.route}-${run.mode}`);
		assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" }); assert.equal(run.floor, "2.36");
		const prefix = `${run.label}/records/`, records = async path => files.get(prefix + path);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), nominalSubtypeRustRecords(run.route, JSON.parse(await records("crate.json")), JSON.parse(await records("dependencies.json"))).sort());
		const checked = await checkNominalSubtypeRustReport(records, run);
		for(const [key, value] of Object.entries(checked)) assert.deepEqual(run[key], value);
		const reportBytes = await records("report.json"), report = JSON.parse(reportBytes);
		assert.equal(sha256(reportBytes), run.reportSha256);
		const start = JSON.parse(files.get(`${run.label}/start.json`)), end = JSON.parse(files.get(`${run.label}/end.json`));
		const tap = files.get(`${run.label}/run.tap`);
		assert.equal(start.started, run.started); assert.equal(end.finished, run.finished); assert.equal(sha256(tap), run.tapSha256);
		assertNominalSubtypeRustRun({ ...run, start, end, tap, runner: files.get("runner.mjs") });
		for(const name of ["rustc", "cargo"]) assert.equal(run.toolchain[name].command, start.environment[`LEAN_BRIDGE_${name.toUpperCase()}`]);
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.label + "/") || file.path.startsWith("sources/") || file.path.startsWith("checkers/") || file.path === "runner.mjs");
		references.push({ id: `nominal-subtype-rust-${run.route}-${run.mode}-installed`
			, route: run.route, mode: run.mode
			, sourcePath: run.route === "ordinary" ? "ordinary-source" : "reviewed-ir"
			, profiles: [...nominalSubtypeRustProfiles]
			, revision: run.producerCommit, command, counts: checked
			, scope: `Two independent author roots reproduce the complete Rust crate. Author sources are removed before offline installation; unchanged callers replay after moving each installed consumer tree and again after deleting all consumer sources, for three executions per selection. ${run.mode === "full" ? "The full fixture checks per-use constructor selection and normalization, repeated record fields, active variant branches, aliases, mixed Fin guards, exact rejection paths, caller-input preservation and recovery." : "The standalone result-only fixture projects scalars, structural containers, records, variants and aliases without input constructor choices, including 100-bit Nat results."} ${nominalSubtypeRustLimit}`
			, files: [{ path: `${nominalSubtypeRustArchive}/index.json`, sha256: nominalSubtypeRustIndexSha256 }, ...selected.map(file => ({ path: `${nominalSubtypeRustArchive}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: [...Object.entries(report.builds[0].archives).map(([path, digest]) => ({ path, sha256: digest })), { path: `dependency-handoff/${report.dependencies.archive}`, sha256: report.dependencies.sha256 }] });
	}
	return references;
};

/**
 * Add Rust field observations and supplement its two existing parameter/result rows.
 *
 * @param original - Exact inventory before this milestone.
 * @param references - Four independently authenticated installed selections.
 */
export const promoteNominalSubtypeRust = async (original, references) => {
	assert.deepEqual(references, await nominalSubtypeRustReferences());
	const inventory = structuredClone(original), validators = [];
	for(const path of ["tests/helpers/nominal-subtype-rust-report.mjs", "tests/helpers/nominal-subtype-rust-promotion.mjs", "tests/helpers/nominal-subtype-rust-promotion-tests.mjs", "docs/evidence/nominal-subtype-rust-acceptance-20261012.md"])
		validators.push({ path, sha256: sha256(await readFile(path)) });
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision, command: reference.command
			, scope: reference.scope
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const matches = inventory.observations.filter(item => item.path === path && item.shapes.includes("subtype") && item.profiles.includes("rust"));
		assert.equal(matches.length, 1, "Missing or overlapping Rust Subtype observation");
		const observation = matches[0];
		assert.deepEqual(observation.profiles, nominalSubtypeRustProfiles);
		assert.deepEqual(observation.shapes, ["subtype"]); assert.deepEqual(observation.positions, ["parameter", "result"]);
		const matched = references.filter(item => item.sourcePath === path), ids = matched.map(item => item.id);
		assert.equal(matched.length, 2);
		const scope = matched.map(item => item.scope).join(" ");
		observation.scope += " Additional nominal Rust acceptance: " + scope;
		observation.conversionNotes.subtype += " " + nominalSubtypeRustConversion;
		observation.limitations.push(nominalSubtypeRustLimit);
		for(const position of observation.positions) observation.hostTypes.subtype[position] += nominalSubtypeRustHostSuffix;
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
			stage.note += " Additional nominal Rust acceptance: " + scope;
		}
		inventory.observations.push({ id: `nominal-subtype-rust-fields-${path}`
			, profiles: [...nominalSubtypeRustProfiles], shapes: ["subtype"]
			, positions: ["field"], path, scope
			, hostTypes: { subtype: { field: "BigUint payload in generated structs and enums for the tested acyclic records and variants; no proof field" } }
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: ids, note: scope }]))
			, limitations: [nominalSubtypeRustLimit]
			, conversionNotes: { subtype: observation.conversionNotes.subtype } });
	}
	return inventory;
};
